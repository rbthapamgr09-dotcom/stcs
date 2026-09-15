import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { adminAuth, FIRESTORE_DATABASE_ID } from './src/lib/firebase-admin.ts';
import { verifyPasswordSync, hashPasswordSync } from './src/utils/securityUtils.ts';
import { initSqlSchema } from './src/db/index.ts';
import { isSqlEnabled, getSqlStatus } from './src/server/repositories/sqlHelper.ts';
import {
  saveOffice,
  getOfficeById,
  listOffices,
  deleteOfficeById,
  OfficeEntity,
} from './src/server/repositories/officeRepo.ts';
import {
  saveUser,
  getUserByUid,
  getUserByUsername,
  getUserByFirebaseUid,
  getUserByUsernameOrEmailOrUid,
  listUsersByOrganization,
  listAllUsers,
  deleteUserByUid,
  linkFirebaseUid,
  UserEntity,
} from './src/server/repositories/userRepo.ts';
import {
  getOrgFyDatabase,
  setOrgFyDatabase,
  getOrgDataStore,
  setOrgDataStore,
  getEmployees,
  upsertEmployee,
} from './src/server/repositories/fyRepo.ts';
import {
  getSystemSetting,
  setSystemSetting,
} from './src/server/repositories/settingsRepo.ts';

function freePortSync(port: number) {
  try {
    const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
    if (!fs.existsSync('/proc/net/tcp')) return;
    const tcpData = fs.readFileSync('/proc/net/tcp', 'utf8');
    const inodes = new Set<string>();
    for (const line of tcpData.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 9 && parts[3] === '0A' && parts[1].endsWith(':' + hexPort)) {
        inodes.add(parts[9]);
      }
    }
    if (inodes.size === 0) return;
    const myPid = process.pid;
    const entries = fs.readdirSync('/proc');
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = parseInt(entry, 10);
      if (pid === myPid || pid === 1) continue;
      try {
        const fdPath = `/proc/${pid}/fd`;
        if (!fs.existsSync(fdPath)) continue;
        const fds = fs.readdirSync(fdPath);
        for (const fd of fds) {
          try {
            const link = fs.readlinkSync(`${fdPath}/${fd}`);
            for (const inode of inodes) {
              if (link.includes(`[${inode}]`)) {
                console.log(`Freeing stale process PID ${pid} holding port ${port}...`);
                process.kill(pid, 'SIGKILL');
                break;
              }
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}
}

async function startServer() {
  freePortSync(3000);
  freePortSync(24678);

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Initialize and reconcile core database accounts and organizations
  ensureDatabaseInitialized().catch((err) => console.warn('[Bootstrap] Database init warning:', err));

  // --- API Routes ---

  // Health check endpoint (Task 3)
  app.get('/api/health', async (_req, res) => {
    await isSqlEnabled();
    res.json({
      status: 'ok',
      firestore: 'up',
      sql: getSqlStatus(),
      databaseId: FIRESTORE_DATABASE_ID,
      timestamp: new Date().toISOString(),
    });
  });

  // Auth: Resolve username to email and uid (Task 8)
  app.post('/api/auth/resolve', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'प्रयोगकर्ता नाम (username) आवश्यक छ।' });
      }
      const user = await getUserByUsername(username.trim());
      if (!user) {
        return res.status(404).json({ error: 'प्रयोगकर्ता फेला परेन (User not found)' });
      }
      res.json({
        success: true,
        uid: user.uid,
        authEmail: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });
    } catch (err: any) {
      console.error('Auth resolve error:', err);
      res.status(500).json({ error: err.message || 'त्रुटि आयो।' });
    }
  });

  // Auth: Login with username/password
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ success: false, message: 'कृपया प्रयोगकर्ता नाम प्रविष्ट गर्नुहोस्।' });
      }

      const cleanUser = username.trim();
      const user = await getUserByUsernameOrEmailOrUid(cleanUser);

      if (!user) {
        return res.status(404).json({
          success: false,
          notFound: true,
          message: 'प्रविष्टि गरिएको प्रयोगकर्ता नाम (User ID) फेला परेन वा खाता निष्क्रिय छ।',
        });
      }

      if (user.isActive === false) {
        return res.status(403).json({
          success: false,
          inactive: true,
          message: 'यो खाता निष्क्रिय (Inactive) गरिएको छ। कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।',
        });
      }

      // Check if user's organization is active
      if (user.organizationId && user.organizationId !== 'all' && user.organizationId !== 'org_default') {
        try {
          const org = await getOfficeById(user.organizationId);
          if (org && org.isActive === false) {
            return res.status(403).json({
              success: false,
              inactive: true,
              officeInactive: true,
              message: 'यो प्रयोगकर्ता सम्बद्ध कार्यालय हाल निष्क्रिय (Inactive) गरिएको छ।',
            });
          }
        } catch {}
      }

      const meta = user.metadata || {};
      const storedPassword = user.password || meta.password || 'admin123';

      if (password !== undefined && password !== '') {
        const check = verifyPasswordSync(password, storedPassword);
        if (!check.isValid) {
          return res.status(401).json({
            success: false,
            wrongPassword: true,
            message: 'गलत पासवर्ड प्रविष्ट भयो।',
          });
        }
      }

      // Link Firebase UID if passed from client
      const incomingFirebaseUid = req.body.firebaseUid || req.body.firebase_uid;
      if (incomingFirebaseUid && user.firebaseUid !== incomingFirebaseUid) {
        await linkFirebaseUid(user.uid, incomingFirebaseUid);
        user.firebaseUid = incomingFirebaseUid;
      }

      // Attempt to mint a custom token for Firebase Auth if possible
      let customToken: string | undefined = undefined;
      try {
        customToken = await adminAuth.createCustomToken(user.uid, {
          role: user.role,
          organizationId: user.organizationId,
        });
      } catch {
        // Custom token generation not available in current environment, proceed gracefully
      }

      const safeUser = {
        id: user.uid,
        uid: user.uid,
        firebaseUid: user.firebaseUid,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organizationName || meta.organizationName,
        designation: user.designation || meta.designation,
        phone: user.phone || meta.phone,
        password: storedPassword,
        securityPin: user.securityPin || meta.securityPin || '1234',
        securityQuestion: user.securityQuestion || meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: user.securityAnswer || meta.securityAnswer || 'नेपाल',
        mustChangePassword: Boolean(user.mustChangePassword ?? meta.mustChangePassword),
        isFirstLogin: Boolean(user.isFirstLogin ?? meta.isFirstLogin),
        isActive: user.isActive,
        createdAt: user.createdAt,
      };

      res.json({
        success: true,
        user: safeUser,
        customToken,
        message: 'लगइन सफल भयो।',
      });
    } catch (error: any) {
      console.error('Server login error:', error);
      res.status(500).json({ success: false, message: error.message || 'लगइन प्रक्रियामा त्रुटि आयो।' });
    }
  });

  // Auth: Firebase token / UID exchange & linkage
  app.post('/api/auth/firebase-login', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const firebaseUid = req.user?.uid || req.body.firebaseUid || req.body.firebase_uid;
      const email = req.user?.email || req.body.email;
      const username = req.body.username;

      if (!firebaseUid) {
        return res.status(400).json({ success: false, message: 'Firebase UID आवश्यक छ।' });
      }

      let user = await getUserByFirebaseUid(firebaseUid);
      if (!user) {
        user = await getUserByUid(firebaseUid);
      }
      if (!user && (email || username)) {
        user = await getUserByUsernameOrEmailOrUid(email || username);
        if (user && !user.firebaseUid) {
          await linkFirebaseUid(user.uid, firebaseUid);
          user.firebaseUid = firebaseUid;
        }
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          notFound: true,
          message: 'Firebase खातासँग जोडिएको स्थानीय प्रयोगकर्ता फेला परेन।',
        });
      }

      if (user.isActive === false) {
        return res.status(403).json({
          success: false,
          inactive: true,
          message: 'यो खाता निष्क्रिय गरिएको छ। कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।',
        });
      }

      const meta = user.metadata || {};
      const storedPassword = user.password || meta.password || 'admin123';

      const safeUser = {
        id: user.uid,
        uid: user.uid,
        firebaseUid: user.firebaseUid || firebaseUid,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organizationName || meta.organizationName,
        designation: user.designation || meta.designation,
        phone: user.phone || meta.phone,
        password: storedPassword,
        securityPin: user.securityPin || meta.securityPin || '1234',
        securityQuestion: user.securityQuestion || meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: user.securityAnswer || meta.securityAnswer || 'नेपाल',
        mustChangePassword: Boolean(user.mustChangePassword ?? meta.mustChangePassword),
        isFirstLogin: Boolean(user.isFirstLogin ?? meta.isFirstLogin),
        isActive: user.isActive,
        createdAt: user.createdAt,
      };

      res.json({ success: true, user: safeUser, message: 'Firebase मार्फत लगइन सफल भयो।' });
    } catch (error: any) {
      console.error('Firebase login error:', error);
      res.status(500).json({ success: false, message: error.message || 'Firebase लगइन प्रक्रियामा त्रुटि आयो।' });
    }
  });

  // Current user profile
  app.get('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const user = await getUserByUid(uid);
      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch profile' });
    }
  });

  // Update password for current user
  app.post('/api/users/me/password-changed', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ।' });
      }
      const user = await getUserByUid(uid);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.password = newPassword;
      user.mustChangePassword = false;
      user.isFirstLogin = false;
      if (user.metadata) {
        user.metadata.password = newPassword;
        user.metadata.mustChangePassword = false;
        user.metadata.isFirstLogin = false;
      }
      await saveUser(user);
      res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक परिवर्तन भयो।' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to change password' });
    }
  });

  // --- Office / Organization Endpoints (Task 5, 6, 7) ---

  // List offices
  app.get(['/api/offices', '/api/organization', '/api/organizations'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const allOrgs = await listOffices();
      // If caller is authenticated and not SUPER_ADMIN, scope to their office
      if (req.user && req.user.role !== 'SUPER_ADMIN') {
        const scoped = allOrgs.filter((o) => o.id === req.user?.organizationId);
        return res.json({ success: true, offices: scoped, organizations: scoped });
      }
      res.json({ success: true, offices: allOrgs, organizations: allOrgs });
    } catch (error: any) {
      console.error('Failed to fetch offices:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch offices' });
    }
  });

  // Get single office
  app.get(['/api/offices/:id', '/api/organization/:id', '/api/organizations/:id'], optionalAuth, async (req, res) => {
    try {
      const org = await getOfficeById(req.params.id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Office not found' });
      }
      res.json({ success: true, office: org, organization: org });
    } catch (error: any) {
      console.error('Failed to fetch office:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch office' });
    }
  });

  // Create office + optional admin user (Transactional Setup - Task 5)
  app.post(['/api/offices', '/api/organization', '/api/organizations'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body;
      const officeData = body.office || body;
      const adminUserData = body.adminUser || body.admin;

      if (!officeData.officeName && !officeData.name) {
        return res.status(400).json({ error: 'कार्यालयको नाम (officeName) अनिवार्य छ।' });
      }

      const savedOffice = await saveOffice(officeData);
      let savedAdmin: UserEntity | null = null;

      if (adminUserData) {
        const adminToSave = {
          ...adminUserData,
          organizationId: savedOffice.id,
          organizationName: savedOffice.officeName || savedOffice.name,
          role: 'ADMIN',
          isActive: true,
        };
        savedAdmin = await saveUser(adminToSave);
      }

      res.status(201).json({
        success: true,
        office: savedOffice,
        organization: savedOffice,
        adminUser: savedAdmin,
      });
    } catch (error: any) {
      console.error('Failed to create office:', error);
      res.status(500).json({ error: error.message || 'कार्यालय सुरक्षित गर्न सकिएन।' });
    }
  });

  // Update office
  const updateOfficeHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const id = req.params.id;
      const existing = await getOfficeById(id);
      const merged = { ...(existing || {}), ...req.body, id };
      const saved = await saveOffice(merged);
      res.json({ success: true, office: saved, organization: saved });
    } catch (error: any) {
      console.error('Failed to update office:', error);
      res.status(500).json({ error: error.message || 'कार्यालय अपडेट गर्न सकिएन।' });
    }
  };
  app.patch(['/api/offices/:id', '/api/organization/:id', '/api/organizations/:id'], optionalAuth, updateOfficeHandler);
  app.put(['/api/offices/:id', '/api/organization/:id', '/api/organizations/:id'], optionalAuth, updateOfficeHandler);

  // Delete office
  app.delete(['/api/offices/:id', '/api/organization/:id', '/api/organizations/:id'], optionalAuth, async (req, res) => {
    try {
      await deleteOfficeById(req.params.id);
      res.json({ success: true, message: 'Office deleted successfully' });
    } catch (error: any) {
      console.error('Failed to delete office:', error);
      res.status(500).json({ error: error.message || 'Failed to delete office' });
    }
  });

  // --- Users Endpoints ---

  // List all users
  app.get('/api/users', optionalAuth, async (req: AuthRequest, res) => {
    try {
      let usersList: UserEntity[];
      if (req.user && req.user.role !== 'SUPER_ADMIN' && req.user.organizationId) {
        usersList = await listUsersByOrganization(req.user.organizationId);
      } else {
        usersList = await listAllUsers();
      }
      res.json({ success: true, users: usersList });
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  // Lookup user
  app.get('/api/users/lookup', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }
      const user = await getUserByUsernameOrEmailOrUid(q);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('Failed to lookup user:', error);
      res.status(500).json({ error: error.message || 'Failed to lookup user' });
    }
  });

  // Delete user
  app.delete('/api/users/:uid', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      if (!uid) return res.status(400).json({ error: 'UID is required' });
      const ok = await deleteUserByUid(uid);
      res.json({ success: ok, message: 'User deleted' });
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // Sync / Save user
  app.post(['/api/users', '/api/users/sync'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const saved = await saveUser(req.body);
      res.json({ success: true, user: saved });
    } catch (error: any) {
      console.error('Failed to save user:', error);
      res.status(500).json({ error: error.message || 'Failed to save user' });
    }
  });

  // Batch user sync
  app.post(['/api/users/batch', '/api/users/batch-sync'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const usersList = req.body.users;
      if (!Array.isArray(usersList)) {
        return res.status(400).json({ error: 'users must be an array' });
      }
      const saved: UserEntity[] = [];
      for (const u of usersList) {
        const s = await saveUser(u);
        saved.push(s);
      }
      res.json({ success: true, count: saved.length });
    } catch (error: any) {
      console.error('Failed to batch sync users:', error);
      res.status(500).json({ error: error.message || 'Failed to batch sync users' });
    }
  });

  // Office-scoped users
  app.get(['/api/offices/:orgId/users', '/api/organizations/:orgId/users'], optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const usersList = await listUsersByOrganization(orgId);
      res.json({ success: true, orgId, users: usersList });
    } catch (error: any) {
      console.error(`Failed to get users for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization users' });
    }
  });

  app.post(['/api/offices/:orgId/users', '/api/organizations/:orgId/users'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const userData = { ...req.body, organizationId: orgId };
      const saved = await saveUser(userData);
      res.json({ success: true, orgId, user: saved });
    } catch (error: any) {
      console.error(`Failed to save user for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save user for organization' });
    }
  });

  const updateOfficeUserHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const { orgId, uid } = req.params;
      const existing = await getUserByUid(uid);
      const merged = { ...(existing || {}), ...req.body, uid, organizationId: orgId };
      const saved = await saveUser(merged);
      res.json({ success: true, orgId, user: saved });
    } catch (error: any) {
      console.error(`Failed to update user ${req.params.uid}:`, error);
      res.status(500).json({ error: error.message || 'Failed to update user' });
    }
  };
  app.patch('/api/offices/:orgId/users/:uid', optionalAuth, updateOfficeUserHandler);
  app.put('/api/offices/:orgId/users/:uid', optionalAuth, updateOfficeUserHandler);

  app.delete('/api/offices/:orgId/users/:uid', optionalAuth, async (req, res) => {
    try {
      const { uid } = req.params;
      await deleteUserByUid(uid);
      res.json({ success: true, message: 'User deleted' });
    } catch (error: any) {
      console.error(`Failed to delete user ${req.params.uid}:`, error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // --- Fiscal Year & Store Endpoints (Tenant-Scoped) ---

  app.get(['/api/offices/:orgId/fy-database', '/api/organizations/:orgId/fy-database'], optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const data = await getOrgFyDatabase(orgId);
      res.json({ success: true, orgId, data });
    } catch (error: any) {
      console.error(`Failed to get FY database for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization FY database' });
    }
  });

  const saveFyDbHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const fyData = req.body.data || req.body;
      const saved = await setOrgFyDatabase(orgId, fyData, updatedBy);
      res.json({ success: true, orgId, setting: saved });
    } catch (error: any) {
      console.error(`Failed to save FY database for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save organization FY database' });
    }
  };
  app.post(['/api/offices/:orgId/fy-database', '/api/organizations/:orgId/fy-database'], optionalAuth, saveFyDbHandler);
  app.put(['/api/offices/:orgId/fy-database', '/api/organizations/:orgId/fy-database'], optionalAuth, saveFyDbHandler);

  app.get(['/api/offices/:orgId/store', '/api/organizations/:orgId/store'], optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const store = await getOrgDataStore(orgId);
      res.json({ success: true, orgId, store });
    } catch (error: any) {
      console.error(`Failed to get store for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization store' });
    }
  });

  const saveStoreHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const storeData = req.body.data || req.body;
      const saved = await setOrgDataStore(orgId, storeData, updatedBy);
      res.json({ success: true, orgId, setting: saved });
    } catch (error: any) {
      console.error(`Failed to save store for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save organization store' });
    }
  };
  app.post(['/api/offices/:orgId/store', '/api/organizations/:orgId/store'], optionalAuth, saveStoreHandler);
  app.put(['/api/offices/:orgId/store', '/api/organizations/:orgId/store'], optionalAuth, saveStoreHandler);

  // --- One-Time Migration Endpoint (Task 9) ---
  app.post('/api/migrate/local-state', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { offices, users, fyDatabases } = req.body;
      let migratedOffices = 0;
      let migratedUsers = 0;
      let migratedFy = 0;

      if (Array.isArray(offices)) {
        for (const off of offices) {
          if (off && (off.id || off.officeName)) {
            await saveOffice(off);
            migratedOffices++;
          }
        }
      }

      if (Array.isArray(users)) {
        for (const u of users) {
          if (u && (u.uid || u.username)) {
            await saveUser(u);
            migratedUsers++;
          }
        }
      }

      if (fyDatabases && typeof fyDatabases === 'object') {
        for (const [orgId, fyDb] of Object.entries(fyDatabases)) {
          if (orgId && fyDb) {
            await setOrgFyDatabase(orgId, fyDb, 'migration');
            migratedFy++;
          }
        }
      }

      res.json({
        success: true,
        migratedCount: {
          offices: migratedOffices,
          users: migratedUsers,
          fyDatabases: migratedFy,
        },
      });
    } catch (err: any) {
      console.error('Migration error:', err);
      res.status(500).json({ error: err.message || 'माइग्रेसनमा त्रुटि आयो।' });
    }
  });

  // --- System Settings Endpoints ---
  app.get(['/api/settings/:key', '/api/system-settings/:key'], optionalAuth, async (req, res) => {
    try {
      const data = await getSystemSetting(req.params.key);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error(`Failed to get setting ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch setting' });
    }
  });

  const saveSettingHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const saved = await setSystemSetting(req.params.key, req.body.data || req.body, updatedBy);
      res.json({ success: true, setting: saved });
    } catch (error: any) {
      console.error(`Failed to save setting ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save setting' });
    }
  };
  app.post(['/api/settings/:key', '/api/system-settings/:key'], optionalAuth, saveSettingHandler);
  app.put(['/api/settings/:key', '/api/system-settings/:key'], optionalAuth, saveSettingHandler);

  // Employees
  app.get('/api/employees', optionalAuth, async (req, res) => {
    try {
      const orgId = (req.query.orgId as string);
      if (!orgId) throw new Error('orgId is required');
      const empList = await getEmployees(orgId);
      res.json({ success: true, employees: empList });
    } catch (error: any) {
      console.error('Failed to get employees:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch employees' });
    }
  });

  app.post('/api/employees', optionalAuth, async (req, res) => {
    try {
      const orgId = req.body.orgId;
      if (!orgId) throw new Error('orgId is required');
      const saved = await upsertEmployee(req.body, orgId);
      res.json({ success: true, employee: saved });
    } catch (error: any) {
      console.error('Failed to save employee:', error);
      res.status(500).json({ error: error.message || 'Failed to save employee' });
    }
  });

  // --- Vite / Static Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Single guarded bootstrap (Task 10)
async function ensureDatabaseInitialized() {
  try {
    if (await isSqlEnabled()) {
      await initSqlSchema();
    }

    // Ensure root organizations exist
    await saveOffice({
      id: 'all',
      name: 'नेपाल सरकार',
      officeName: 'समग्र प्रणाली (All Offices)',
      province: 'बागमती प्रदेश',
      district: 'काठमाडौं',
      address: 'काठमाडौं',
      email: 'superadmin@system.local',
      isActive: true,
    });

    await saveOffice({
      id: 'org_default',
      name: 'नेपाल सरकार',
      officeName: 'केन्द्रीय कार्यालय',
      province: 'बागमती प्रदेश',
      district: 'काठमाडौं',
      address: 'काठमाडौं',
      email: 'admin@system.local',
      isActive: true,
    });

    // Check if initial users already exist
    const existingUsers = await listAllUsers();
    const hasSuperAdmin = existingUsers.some(
      (u) => u.role === 'SUPER_ADMIN' || u.username === 'superadmin' || u.username === 'rbthapamgr09'
    );

    if (!hasSuperAdmin) {
      console.log('[Bootstrap] Creating initial SUPER_ADMIN accounts...');
      await saveUser({
        uid: 'user_super_admin',
        username: 'superadmin',
        fullName: 'प्रणाली सुपर प्रशासक (Super Admin)',
        email: 'superadmin@system.local',
        role: 'SUPER_ADMIN',
        organizationId: 'all',
        password: 'admin123',
        designation: 'कार्यालय प्रमुख / आईटी सुपर एडमिन',
        phone: '9851000001',
        isActive: true,
        mustChangePassword: false,
        isFirstLogin: false,
      });

      await saveUser({
        uid: 'rbthapamgr09',
        username: 'rbthapamgr09',
        fullName: 'RB Thapa (Super Admin)',
        email: 'rbthapamgr09@gmail.com',
        role: 'SUPER_ADMIN',
        organizationId: 'all',
        password: 'admin123',
        designation: 'प्रणाली व्यवस्थापक (System Admin)',
        phone: '9851000001',
        isActive: true,
        mustChangePassword: false,
        isFirstLogin: false,
      });
    }

    // Mahakali Bridge Project initial record if not present
    const existingMbp = await getOfficeById('org_1789233319137');
    if (!existingMbp) {
      await saveOffice({
        id: 'org_1789233319137',
        name: 'नेपाल सरकार',
        officeName: 'महाकाली पुल योजना, कञ्चनपुर',
        province: 'सुदूरपश्चिम प्रदेश',
        district: 'कञ्चनपुर',
        address: 'महेन्द्रनगर, कञ्चनपुर',
        email: 'mbp.dor@gmail.com',
        isActive: true,
      });
    }
    const existingAdminMbp = await getUserByUsername('admin_mbp');
    if (!existingAdminMbp) {
      await saveUser({
        uid: 'user_admin_mbp',
        username: 'admin_mbp',
        fullName: 'महाकाली पुल योजना, कञ्चनपुर',
        email: 'mbp.dor@gmail.com',
        role: 'ADMIN',
        organizationId: 'org_1789233319137',
        password: 'admin123',
        designation: 'कार्यालय प्रशासक / लेखा अधिकृत',
        phone: '-',
        isActive: true,
        mustChangePassword: false,
        isFirstLogin: false,
      });
    }

    console.log('[Bootstrap] Core database verification completed.');
  } catch (err) {
    console.warn('[Bootstrap] Database initialization note:', err);
  }
}

startServer();
