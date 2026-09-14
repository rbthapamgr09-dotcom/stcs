import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  getUsers,
  getUserByUid,
  deleteUserByUid,
  getUserByUsernameOrEmailOrUid,
  upsertUsersBatch,
  getUsersByOrganization,
} from './src/db/users.ts';
import { verifyPasswordSync } from './src/utils/securityUtils.ts';
import {
  getOrganizations,
  getOrganizationById,
  upsertOrganization,
  deleteOrganizationById,
  getSystemSetting,
  setSystemSetting,
  getEmployees,
  upsertEmployee,
  getOrgFyDatabase,
  setOrgFyDatabase,
  getOrgDataStore,
  setOrgDataStore,
} from './src/db/payroll.ts';

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
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

async function startServer() {
  freePortSync(3000);
  freePortSync(24678);

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---

  // Initialize and reconcile core database accounts and organizations
  ensureDatabaseInitialized().catch((err) => console.warn('Core database init warning:', err));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: 'Cloud SQL (PostgreSQL)',
      timestamp: new Date().toISOString(),
    });
  });

  // Dedicated server-side login authentication endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ success: false, message: 'कृपया प्रयोगकर्ता नाम प्रविष्ट गर्नुहोस्।' });
      }

      const cleanUser = username.trim();
      let user = await getUserByUsernameOrEmailOrUid(cleanUser);

      // Auto-reconciliation fallback for known office admin accounts
      if (!user) {
        if (cleanUser.toLowerCase() === 'admin_mbp') {
          user = await getOrCreateUser(
            'user_admin_mbp',
            'mbp.dor@gmail.com',
            'admin_mbp',
            'महाकाली पुल योजना, कञ्चनपुर',
            'ADMIN',
            'org_1789233319137',
            {
              password: 'admin123',
              organizationName: 'महाकाली पुल योजना',
              designation: 'कार्यालय प्रशासक / लेखा अधिकृत',
              phone: '-',
              securityPin: '1234',
              securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
              securityAnswer: 'नेपाल',
              isActive: true,
              mustChangePassword: false,
              isFirstLogin: false,
            }
          );
        } else {
          // Check if any organization in database has this admin pattern
          try {
            const orgs = await getOrganizations();
            const matchedOrg = orgs.find(
              (o) =>
                ((o.officeCode || (o as any).code) && `admin_${((o.officeCode || (o as any).code) as string).toLowerCase()}` === cleanUser.toLowerCase()) ||
                (o.registrationNo && `admin_${o.registrationNo.toLowerCase()}` === cleanUser.toLowerCase()) ||
                (o.email && o.email.toLowerCase() === cleanUser.toLowerCase())
            );
            if (matchedOrg) {
              const orgName = (matchedOrg as any).officeName || (matchedOrg as any).name || 'कार्यालय';
              user = await getOrCreateUser(
                `user_${cleanUser.toLowerCase()}`,
                matchedOrg.email || `${cleanUser}@system.local`,
                cleanUser,
                orgName,
                'ADMIN',
                matchedOrg.id,
                {
                  password: 'admin123',
                  organizationName: orgName,
                  isActive: true,
                  securityPin: '1234',
                  mustChangePassword: false,
                  isFirstLogin: false,
                }
              );
            }
          } catch (lookupErr) {
            console.warn('Auto org-admin lookup note:', lookupErr);
          }
        }
      }

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
      if (user.organizationId && user.organizationId !== 'org_default') {
        try {
          const org = await getOrganizationById(user.organizationId);
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

      const meta = (user.metadata as any) || {};
      const storedPassword =
        meta.password ||
        (user.role === 'SUPER_ADMIN' ? 'admin123' : user.role === 'ADMIN' ? 'admin123' : 'viewer123');

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

      const safeUser = {
        id: user.uid || String(user.id),
        uid: user.uid,
        username: user.username,
        fullName:
          user.username?.toLowerCase() === 'admin_mbp' &&
          (!user.fullName || user.fullName === 'Mahakali Bridge Project' || user.fullName === 'admin_mbp')
            ? 'महाकाली पुल योजना, कंचनपुर'
            : user.fullName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || 'org_default',
        organizationName:
          user.organizationName ||
          meta.organizationName ||
          (user.username?.toLowerCase() === 'admin_mbp' ? 'महाकाली पुल योजना' : undefined),
        designation: user.designation || meta.designation,
        phone: user.phone || meta.phone,
        password: storedPassword,
        securityPin: meta.securityPin || '1234',
        securityQuestion: meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: meta.securityAnswer || 'नेपाल',
        mustChangePassword: Boolean(meta.mustChangePassword),
        isFirstLogin: Boolean(meta.isFirstLogin),
        isActive: user.isActive,
        createdAt: user.createdAt,
      };

      res.json({ success: true, user: safeUser, message: 'लगइन सफल भयो।' });
    } catch (error: any) {
      console.error('Server login error:', error);
      res.status(500).json({ success: false, message: error.message || 'लगइन प्रक्रियामा त्रुटि आयो।' });
    }
  });

  // User synchronization & authentication endpoint
  app.post('/api/users/sync', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email, username, fullName, role, organizationId, metadata } = req.body;
      const targetUid = uid || req.user?.uid;
      const targetEmail = email || req.user?.email;

      if (!targetUid) {
        return res.status(400).json({ error: 'User UID is required' });
      }

      const user = await getOrCreateUser(
        targetUid,
        targetEmail || '',
        username,
        fullName,
        role,
        organizationId,
        metadata
      );
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // Batch User synchronization endpoint
  app.post(['/api/users/batch', '/api/users/batch-sync'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const usersList = req.body.users;
      if (!Array.isArray(usersList)) {
        return res.status(400).json({ error: 'users must be an array' });
      }
      const saved = await upsertUsersBatch(usersList);
      res.json({ success: true, count: saved.length });
    } catch (error: any) {
      console.error('Failed to batch sync users:', error);
      res.status(500).json({ error: error.message || 'Failed to batch sync users' });
    }
  });

  // Get all users
  app.get('/api/users', optionalAuth, async (_req: AuthRequest, res) => {
    try {
      const allUsers = await getUsers();
      res.json({ success: true, users: allUsers });
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  // User lookup endpoint by username, email, or UID
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

  // Delete user endpoint
  app.delete('/api/users/:uid', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      if (!uid) {
        return res.status(400).json({ error: 'UID is required' });
      }
      const deleted = await deleteUserByUid(uid);
      res.json({ success: true, user: deleted });
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // Get current user profile
  app.get('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await getUserByUid(req.user.uid);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('Failed to fetch user me:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
    }
  });

  // Organization settings
  app.get(['/api/organization', '/api/organizations'], optionalAuth, async (_req, res) => {
    try {
      const orgs = await getOrganizations();
      res.json({ success: true, organizations: orgs });
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization' });
    }
  });

  app.get(['/api/organization/:id', '/api/organizations/:id'], optionalAuth, async (req, res) => {
    try {
      const org = await getOrganizationById(req.params.id);
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }
      res.json({ success: true, organization: org });
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization' });
    }
  });

  app.post(['/api/organization', '/api/organizations'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertOrganization(req.body);
      res.json({ success: true, organization: saved });
    } catch (error: any) {
      console.error('Failed to save organization:', error);
      res.status(500).json({ error: error.message || 'Failed to save organization' });
    }
  });

  app.delete(['/api/organization/:id', '/api/organizations/:id'], optionalAuth, async (req, res) => {
    try {
      await deleteOrganizationById(req.params.id);
      res.json({ success: true, message: 'Organization deleted successfully' });
    } catch (error: any) {
      console.error('Failed to delete organization:', error);
      res.status(500).json({ error: error.message || 'Failed to delete organization' });
    }
  });

  // Organization-scoped Fiscal Year Database (Isolated per office and per FY)
  app.get('/api/organizations/:orgId/fy-database', optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const data = await getOrgFyDatabase(orgId);
      res.json({ success: true, orgId, data });
    } catch (error: any) {
      console.error(`Failed to get FY database for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization FY database' });
    }
  });

  app.post('/api/organizations/:orgId/fy-database', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const fyData = req.body.data || req.body;
      const saved = await setOrgFyDatabase(orgId, fyData, updatedBy);
      res.json({ success: true, orgId, setting: saved });
    } catch (error: any) {
      console.error(`Failed to save FY database for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save organization FY database' });
    }
  });

  // Organization-scoped Tax References
  app.get('/api/organizations/:orgId/tax-references', optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const fiscalYear = (req.query.fiscalYear as string) || '';
      const fyData = await getOrgFyDatabase(orgId);
      if (fyData && fiscalYear && fyData[fiscalYear]?.taxReferences) {
        return res.json({ success: true, orgId, fiscalYear, taxReferences: fyData[fiscalYear].taxReferences });
      }
      res.json({ success: true, orgId, fiscalYear, taxReferences: null });
    } catch (error: any) {
      console.error(`Failed to get tax references for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch tax references' });
    }
  });

  app.post('/api/organizations/:orgId/tax-references', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const { fiscalYear, taxReferences } = req.body;
      const fyData = (await getOrgFyDatabase(orgId)) || {};
      if (fiscalYear) {
        if (!fyData[fiscalYear]) {
          fyData[fiscalYear] = { employees: [], salarySetups: {}, deductionSetups: {}, taxReferences: [] };
        }
        fyData[fiscalYear].taxReferences = taxReferences;
        await setOrgFyDatabase(orgId, fyData, updatedBy);
      }
      res.json({ success: true, orgId, fiscalYear, count: taxReferences?.length || 0 });
    } catch (error: any) {
      console.error(`Failed to save tax references for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save tax references' });
    }
  });

  // Organization-scoped Data Store (Complete tenant bundle: details, FY list, active FY, fyDatabase, users)
  app.get('/api/organizations/:orgId/store', optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const store = await getOrgDataStore(orgId);
      res.json({ success: true, orgId, store });
    } catch (error: any) {
      console.error(`Failed to get store for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization store' });
    }
  });

  app.post('/api/organizations/:orgId/store', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const storeData = req.body.data || req.body;
      const saved = await setOrgDataStore(orgId, storeData, updatedBy);
      res.json({ success: true, orgId, setting: saved });
    } catch (error: any) {
      console.error(`Failed to save store for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save organization store' });
    }
  });

  // Organization-scoped Users (User Profile Data bound to organization)
  app.get('/api/organizations/:orgId/users', optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId || orgId === 'all') {
        const allUsers = await getUsers();
        return res.json({ success: true, users: allUsers });
      }
      const orgUsers = await getUsersByOrganization(orgId);
      res.json({ success: true, orgId, users: orgUsers });
    } catch (error: any) {
      console.error(`Failed to get users for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization users' });
    }
  });

  app.post('/api/organizations/:orgId/users', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.orgId || 'org_default';
      const { uid, email, username, fullName, role, designation, phone, metadata, password } = req.body;
      const targetUid = uid || username || `user_${Date.now()}`;
      const targetEmail = email || `${(username || targetUid).toLowerCase()}@system.local`;

      const meta = {
        ...(metadata || {}),
        password: password || metadata?.password || 'user123',
        designation: designation || metadata?.designation || '',
        phone: phone || metadata?.phone || '',
        organizationId: orgId,
      };

      const user = await getOrCreateUser(
        targetUid,
        targetEmail,
        username,
        fullName,
        role,
        orgId,
        meta
      );
      res.json({ success: true, orgId, user });
    } catch (error: any) {
      console.error(`Failed to save user for org ${req.params.orgId}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save user for organization' });
    }
  });

  // System Settings (Google Sheets connection, payroll state, etc.)
  app.get(['/api/settings/:key', '/api/system-settings/:key'], optionalAuth, async (req, res) => {
    try {
      const data = await getSystemSetting(req.params.key);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error(`Failed to get setting ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch setting' });
    }
  });

  app.post(['/api/settings/:key', '/api/system-settings/:key'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const updatedBy = req.user?.email || req.body.updatedBy || 'system';
      const saved = await setSystemSetting(req.params.key, req.body.data || req.body, updatedBy);
      res.json({ success: true, setting: saved });
    } catch (error: any) {
      console.error(`Failed to save setting ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save setting' });
    }
  });

  // Employees
  app.get('/api/employees', optionalAuth, async (req, res) => {
    try {
      const orgId = (req.query.orgId as string) || 'org_default';
      const empList = await getEmployees(orgId);
      res.json({ success: true, employees: empList });
    } catch (error: any) {
      console.error('Failed to get employees:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch employees' });
    }
  });

  app.post('/api/employees', optionalAuth, async (req, res) => {
    try {
      const orgId = req.body.orgId || 'org_default';
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

async function ensureDatabaseInitialized() {
  try {
    // 1. Ensure Super Admin and Demo Accounts
    await getOrCreateUser(
      'user_super_admin',
      'superadmin@system.local',
      'superadmin',
      'प्रणाली सुपर प्रशासक (Super Admin)',
      'SUPER_ADMIN',
      'all',
      {
        password: 'admin123',
        organizationName: 'समग्र प्रणाली (All Offices)',
        designation: 'कार्यालय प्रमुख / आईटी सुपर एडमिन',
        phone: '9851000001',
        isActive: true,
        mustChangePassword: false,
        isFirstLogin: false,
        securityPin: '1234',
        securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: 'नेपाल',
      }
    );

    await getOrCreateUser(
      'rbthapamgr09',
      'rbthapamgr09@gmail.com',
      'rbthapamgr09',
      'RB Thapa (Super Admin)',
      'SUPER_ADMIN',
      'all',
      {
        password: 'admin123',
        organizationName: 'समग्र प्रणाली (All Offices)',
        designation: 'प्रणाली व्यवस्थापक (System Admin)',
        phone: '9851000001',
        isActive: true,
        mustChangePassword: false,
        isFirstLogin: false,
        securityPin: '1234',
        securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: 'नेपाल',
      }
    );

    // 2. Ensure admin_mbp for Mahakali Bridge Project
    await getOrCreateUser(
      'user_admin_mbp',
      'mbp.dor@gmail.com',
      'admin_mbp',
      'महाकाली पुल योजना, कञ्चनपुर',
      'ADMIN',
      'org_1789233319137',
      {
        password: 'admin123',
        organizationName: 'महाकाली पुल योजना',
        designation: 'कार्यालय प्रशासक / लेखा अधिकृत',
        phone: '-',
        securityPin: '1234',
        securityQuestion: 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: 'नेपाल',
        isActive: true,
        mustChangePassword: false,
        isFirstLogin: false,
      }
    );

    // 3. Ensure all registered organizations have active status
    const allOrgs = await getOrganizations();
    for (const org of allOrgs) {
      if (org.isActive === undefined || org.isActive === null) {
        await upsertOrganization({ ...org, isActive: true });
      }
    }
  } catch (err) {
    console.warn('Database initialization note:', err);
  }
}

startServer();
