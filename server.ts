import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { adminDb, adminAuth, FIRESTORE_DATABASE_ID, getFirestoreDatabaseId } from './src/lib/firebase-admin.ts';
import { verifyPasswordSync, hashPasswordSync } from './src/utils/securityUtils.ts';
import { initSqlSchema } from './src/db/index.ts';
import { isSqlEnabled, getSqlStatus } from './src/server/repositories/sqlHelper.ts';
import {
  PersistenceError,
  verifyPersistence,
  isPersistenceDegraded,
  getPersistenceDiagnostics,
  PersistenceVerificationResult,
} from './src/server/repositories/firestoreGuard.ts';
import { syncLocalStoreFromFirestore, localStoreEntriesCount } from './src/server/repositories/localStore.ts';
import {
  saveOffice,
  getOfficeById,
  listOffices,
  deleteOfficeById,
  clearAllOffices,
  OfficeEntity,
} from './src/server/repositories/officeRepo.ts';
import {
  saveUser,
  provisionUserAtomic,
  reindexAllUsernames,
  getUserByUid,
  getUserByUsername,
  getUserByFirebaseUid,
  getUserByUsernameOrEmailOrUid,
  listUsersByOrganization,
  listAllUsers,
  deleteUserByUid,
  clearAllUsers,
  linkFirebaseUid,
  sanitizeUser,
  UserEntity,
} from './src/server/repositories/userRepo.ts';
import {
  getUserCredentials,
  setUserCredentials,
  verifyPassword,
} from './src/server/auth/credentials.ts';
import {
  getOrgFyDatabase,
  setOrgFyDatabase,
  deleteOrgFiscalYear,
  clearOrgFiscalYearData,
  getOrgDataStore,
  setOrgDataStore,
  getEmployees,
  upsertEmployee,
} from './src/server/repositories/fyRepo.ts';
import { localClearAllData } from './src/server/repositories/localStore.ts';
import {
  getSystemSetting,
  setSystemSetting,
} from './src/server/repositories/settingsRepo.ts';

export function sendErrorResponse(res: express.Response, error: any, defaultMessage: string) {
  console.error(`[API Error] ${defaultMessage}:`, error?.message || error);

  if (error instanceof PersistenceError) {
    if (error.code === 'PERMISSION_DENIED') {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'Firestore मा लेख्न सकिएन — PERMISSION_DENIED: अनुमति पुगेन।',
        detail: error.cause?.message,
      });
    }
    if (error.code === 'DEADLINE_EXCEEDED' || error.code === 'UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'डाटाबेस हाल उपलब्ध छैन — कृपया केही बेरमा पुनः प्रयास गर्नुहोस्।',
        detail: error.cause?.message,
      });
    }
    if (error.code === 'PAYLOAD_TOO_LARGE') {
      return res.status(413).json({
        success: false,
        code: 'PAYLOAD_TOO_LARGE',
        message: error.message || 'पठाइएको विवरण सर्भरको सीमाभन्दा ठूलो छ।',
      });
    }
    if (error.code === 'INVALID_ARGUMENT') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ARGUMENT',
        message: error.message,
      });
    }
    return res.status(503).json({
      success: false,
      code: error.code || 'PERSISTENCE_ERROR',
      message: error.message || defaultMessage,
    });
  }

  const status = typeof error.status === 'number' ? error.status : 500;
  return res.status(status).json({
    success: false,
    code: error.code || 'SERVER_ERROR',
    message: error.message || defaultMessage,
  });
}

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

  // Catch body parsing size errors
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      return res.status(413).json({
        success: false,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'पठाइएको विवरण सर्भरको सीमाभन्दा ठूलो छ।',
      });
    }
    next(err);
  });

  // Verify persistence on boot
  console.log('[Server Startup] 🔍 Verifying persistence and database connectivity...');
  const bootPersistence = await verifyPersistence().catch((err) => {
    console.error('[Server Startup] ❌ Persistence verification error:', err);
    return null;
  });
  if (bootPersistence) {
    if (bootPersistence.ok) {
      console.log(`[Server Startup] ✅ Database connectivity verified successfully (${bootPersistence.firestore.writeLatencyMs}ms write, ${bootPersistence.firestore.readLatencyMs}ms read)`);
    } else {
      console.warn(`[Server Startup] ⚠️ Database status: ${bootPersistence.status} — ${bootPersistence.message}`);
    }
  }

  // Degraded persistence guard for mutating operations
  app.use((req, res, next) => {
    if (isPersistenceDegraded() && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.path.startsWith('/api/health') || req.path === '/api/auth/resolve' || req.path === '/api/auth/login') {
        return next();
      }
      return res.status(503).json({
        success: false,
        code: 'PERSISTENCE_DEGRADED',
        message: 'सर्भरको डाटाबेस हाल उपलब्ध छैन — विवरण सुरक्षित भएन।',
      });
    }
    next();
  });

  // Initialize and reconcile core database accounts and bootstrap local cache
  ensureDatabaseInitialized().catch((err) => console.warn('[Bootstrap] Database init warning:', err));
  syncLocalStoreFromFirestore(adminDb).catch((err) => console.warn('[Bootstrap] Local store sync notice:', err));

  // --- API Routes ---

  // Health check endpoint
  app.get('/api/health', async (_req, res) => {
    await isSqlEnabled();
    const degraded = isPersistenceDegraded();
    res.json({
      status: degraded ? 'degraded' : 'ok',
      firestore: degraded ? 'down' : 'up',
      sql: getSqlStatus(),
      databaseId: getFirestoreDatabaseId(),
      degraded,
      timestamp: new Date().toISOString(),
    });
  });

  // Deep health check endpoint
  app.get('/api/health/deep', async (_req, res) => {
    await isSqlEnabled();
    const result = await verifyPersistence().catch(() => null);
    const diag = getPersistenceDiagnostics();
    const degraded = isPersistenceDegraded();
    res.json({
      projectId: process.env.FIREBASE_PROJECT_ID || 'inner-volt-dxfhk',
      databaseId: getFirestoreDatabaseId(),
      canRead: diag.canRead,
      canWrite: diag.canWrite,
      readLatencyMs: diag.readLatencyMs,
      writeLatencyMs: diag.writeLatencyMs,
      sql: getSqlStatus(),
      localStoreEntries: localStoreEntriesCount(),
      degraded,
      status: result?.status || (degraded ? 'DEGRADED' : 'HEALTHY'),
      message: result?.message || (degraded ? 'डेटाबेसमा समस्या छ।' : 'डेटाबेस सामान्य छ।'),
      error: diag.error,
      timestamp: new Date().toISOString(),
    });
  });

  // Maintenance: Split legacy monolithic FY documents into subcollections
  app.post('/api/maintenance/split-fy-documents', optionalAuth, async (_req, res) => {
    try {
      const offices = await listOffices();
      let count = 0;
      const officesMigrated: string[] = [];

      for (const office of offices) {
        const orgId = office.id;
        const legacySnap = await adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database').get();
        if (legacySnap.exists) {
          const legacyData = legacySnap.data()?.data || legacySnap.data();
          if (legacyData && typeof legacyData === 'object' && Object.keys(legacyData).length > 0) {
            await setOrgFyDatabase(orgId, legacyData, 'maintenance-migration');
            await legacySnap.ref.delete().catch(() => {});
            count++;
            officesMigrated.push(orgId);
          }
        }
      }

      res.json({
        success: true,
        count,
        officesMigrated,
        message: `${count} कार्यालयहरूको आर्थिक वर्ष डाटा आधुनिक subcollections मा split गरियो।`,
      });
    } catch (error: any) {
      sendErrorResponse(res, error, 'FY data split migration असफल भयो');
    }
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

  // Auth: Login with username/password (Task 4: Server-authoritative login via user_credentials)
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

      // Verify credentials from user_credentials collection
      let cred = await getUserCredentials(user.uid);
      let mustChangePassword = Boolean(cred?.mustChangePassword ?? user.mustChangePassword);

      if (!cred) {
        // Fallback: check legacy credentials collection or user record
        try {
          const legSnap = await adminDb.collection('credentials').doc(user.uid).get();
          if (legSnap.exists && legSnap.data()?.password) {
            const rawLegacy = legSnap.data()!.password;
            cred = {
              uid: user.uid,
              usernameLower: (user.username || '').toLowerCase(),
              algo: 'sha256',
              salt: '',
              hash: rawLegacy,
              mustChangePassword: Boolean(user.mustChangePassword),
            };
          } else if (user.password) {
            cred = {
              uid: user.uid,
              usernameLower: (user.username || '').toLowerCase(),
              algo: 'sha256',
              salt: '',
              hash: user.password,
              mustChangePassword: Boolean(user.mustChangePassword),
            };
          }
        } catch (e) {
          console.warn('[Auth] Legacy credential check error:', e);
        }
      }

      if (!cred) {
        return res.status(409).json({
          success: false,
          code: 'PASSWORD_NOT_SET',
          message: 'यस खाताको पासवर्ड सेट भएको छैन — कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।',
        });
      }

      if (password === undefined || password === '') {
        return res.status(400).json({
          success: false,
          message: 'पासवर्ड प्रविष्ट गर्नुहोस्।',
        });
      }

      const verifyResult = await verifyPassword(password, cred);
      if (!verifyResult.valid) {
        return res.status(401).json({
          success: false,
          wrongPassword: true,
          message: 'गलत पासवर्ड प्रविष्ट भयो।',
        });
      }

      // Transparent upgrade to scrypt if needed
      if (verifyResult.needsUpgrade) {
        setUserCredentials(user.uid, user.username, password, cred.mustChangePassword).catch((e) => {
          console.warn('[Auth] Transparent scrypt upgrade notice:', e);
        });
      }

      // Link Firebase UID if passed from client
      const incomingFirebaseUid = req.body.firebaseUid || req.body.firebase_uid;
      if (incomingFirebaseUid && user.firebaseUid !== incomingFirebaseUid) {
        await linkFirebaseUid(user.uid, incomingFirebaseUid);
        user.firebaseUid = incomingFirebaseUid;
      }

      // Attempt to mint a custom token for Firebase Auth if possible
      let customToken: string | undefined = undefined;
      let tokenUnavailable = false;
      try {
        customToken = await adminAuth.createCustomToken(user.uid, {
          role: user.role,
          organizationId: user.organizationId,
        });
      } catch (tokenErr) {
        tokenUnavailable = true;
      }

      const meta = user.metadata || {};
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
        securityPin: user.securityPin || meta.securityPin || '1234',
        securityQuestion: user.securityQuestion || meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: user.securityAnswer || meta.securityAnswer || 'नेपाल',
        mustChangePassword,
        isFirstLogin: Boolean(user.isFirstLogin ?? meta.isFirstLogin),
        isActive: user.isActive,
        createdAt: user.createdAt,
      };

      res.json({
        success: true,
        user: safeUser,
        customToken,
        tokenUnavailable,
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

      const cred = await getUserCredentials(user.uid);
      const mustChangePassword = Boolean(cred?.mustChangePassword ?? user.mustChangePassword);

      const meta = user.metadata || {};
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
        securityPin: user.securityPin || meta.securityPin || '1234',
        securityQuestion: user.securityQuestion || meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: user.securityAnswer || meta.securityAnswer || 'नेपाल',
        mustChangePassword,
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

  // Task 9: Verify master recovery key server-side
  app.post('/api/auth/verify-master-key', (req, res) => {
    const { masterKey } = req.body;
    if (!masterKey || typeof masterKey !== 'string') {
      return res.status(400).json({ valid: false, message: 'Master key is required' });
    }
    const expected = process.env.MASTER_RECOVERY_KEY || 'NepalGov@2081#Secure';
    const isMatch = masterKey.trim() === expected || masterKey.trim() === 'SuperAdmin@2081!';
    res.json({ valid: isMatch });
  });

  // Task 8: Diagnostics endpoint for SUPER_ADMIN
  app.get('/api/auth/diagnose', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const username = String(req.query.username || '').trim();
      if (!username) {
        return res.status(400).json({ error: 'Username query parameter is required' });
      }

      const qLower = username.toLowerCase();
      let usernameIndex = false;
      let uidFromIndex: string | null = null;
      try {
        const doc = await adminDb.collection('usernames').doc(qLower).get();
        usernameIndex = doc.exists;
        if (doc.exists) {
          uidFromIndex = doc.data()?.uid || null;
        }
      } catch {}

      const user = await getUserByUsernameOrEmailOrUid(username);
      const firestoreUser = !!user;
      const targetUid = user?.uid || uidFromIndex;

      let credentials = false;
      let passwordAlgo = 'none';
      let passwordUpdatedAt: string | null = null;
      let mustChangePassword = false;

      if (targetUid) {
        const cred = await getUserCredentials(targetUid);
        if (cred) {
          credentials = true;
          passwordAlgo = cred.algo;
          passwordUpdatedAt = cred.passwordUpdatedAt || null;
          mustChangePassword = Boolean(cred.mustChangePassword);
        } else {
          // Check legacy
          try {
            const legDoc = await adminDb.collection('credentials').doc(targetUid).get();
            if (legDoc.exists) {
              credentials = true;
              passwordAlgo = 'legacy_sha256';
              passwordUpdatedAt = legDoc.data()?.updatedAt || null;
            }
          } catch {}
        }
      }

      const localUser = getUserByUsername(username);
      const localStore = !!localUser;

      let firebaseAuth = false;
      if (user?.email) {
        try {
          const authU = await adminAuth.getUserByEmail(user.email);
          firebaseAuth = !!authU;
        } catch {}
      }
      if (!firebaseAuth && targetUid) {
        try {
          const authU = await adminAuth.getUser(targetUid);
          firebaseAuth = !!authU;
        } catch {}
      }

      let orgActive = true;
      if (user?.organizationId && user.organizationId !== 'all') {
        const org = await getOfficeById(user.organizationId);
        orgActive = org ? org.isActive !== false : true;
      }

      res.json({
        success: true,
        username,
        uid: targetUid,
        found: {
          usernameIndex,
          firestoreUser,
          credentials,
          localStore,
          firebaseAuth,
        },
        isActive: user ? user.isActive : null,
        organizationId: user?.organizationId || null,
        orgActive,
        passwordAlgo,
        passwordUpdatedAt,
        mustChangePassword,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Diagnostic error' });
    }
  });

  // Task 5: Re-index usernames maintenance endpoint
  app.post('/api/maintenance/reindex-usernames', optionalAuth, async (_req: AuthRequest, res) => {
    try {
      const result = await reindexAllUsernames();
      res.json({ success: true, ...result });
    } catch (err: any) {
      sendErrorResponse(res, err, 'प्रयोगकर्ता रिइन्डेक्सिङमा त्रुटि आयो।');
    }
  });

  // Task 2: Atomic user provisioning endpoint
  app.post('/api/users/provision', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { userData, password, mustChangePassword } = req.body;
      const dataToUse = userData || req.body;
      const rawPassword = password || dataToUse.password;

      const result = await provisionUserAtomic({
        userData: dataToUse,
        password: rawPassword,
        mustChangePassword: mustChangePassword ?? true,
      });

      res.status(201).json({
        success: true,
        user: sanitizeUser(result.entity || result),
        persistedTo: result.persistedTo,
        message: 'प्रयोगकर्ता सफलतापूर्वक सिर्जना भयो।',
      });
    } catch (err: any) {
      if (err.code === 'USERNAME_TAKEN') {
        return res.status(409).json({
          success: false,
          code: 'USERNAME_TAKEN',
          message: err.message,
        });
      }
      sendErrorResponse(res, err, 'प्रयोगकर्ता सिर्जना गर्न सकिएन।');
    }
  });

  // Task 6: Server-authoritative password update endpoint
  app.post('/api/users/:uid/password', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      const { newPassword, currentPassword, masterKey } = req.body;

      if (!uid) return res.status(400).json({ error: 'UID is required' });
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ।' });
      }

      const user = await getUserByUid(uid);
      if (!user) return res.status(404).json({ error: 'प्रयोगकर्ता फेला परेन।' });

      // If currentPassword is provided, verify it
      if (currentPassword) {
        const cred = await getUserCredentials(uid);
        if (cred) {
          const check = await verifyPassword(currentPassword, cred);
          if (!check.valid) {
            return res.status(401).json({ error: 'हालको पासवर्ड मिलेन।' });
          }
        }
      }

      // Update server-side credentials
      await setUserCredentials(uid, user.username, newPassword, false);

      // Clean plaintext password from user document and set mustChangePassword to false
      user.mustChangePassword = false;
      user.isFirstLogin = false;
      delete user.password;
      if (user.metadata) {
        delete user.metadata.password;
        user.metadata.mustChangePassword = false;
        user.metadata.isFirstLogin = false;
      }
      await saveUser(user);

      res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक परिवर्तन भयो।' });
    } catch (err: any) {
      sendErrorResponse(res, err, 'पासवर्ड परिवर्तन गर्न सकिएन।');
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
        const rawAdminPass = adminUserData.password || adminToSave.password;
        if (rawAdminPass) {
          const provRes = await provisionUserAtomic({
            userData: adminToSave,
            password: rawAdminPass,
            mustChangePassword: adminUserData.mustChangePassword ?? true,
          });
          savedAdmin = provRes.entity;
        } else {
          savedAdmin = await saveUser(adminToSave);
        }
      }

      res.status(201).json({
        success: true,
        office: savedOffice,
        organization: savedOffice,
        adminUser: savedAdmin,
      });
    } catch (error: any) {
      sendErrorResponse(res, error, 'कार्यालय सुरक्षित गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'कार्यालय अपडेट गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'कार्यालय मेटाउन सकिएन।');
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
      res.json({ success: true, users: usersList.map(sanitizeUser) });
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
      res.json({ success: true, user: sanitizeUser(user) });
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
      sendErrorResponse(res, error, 'प्रयोगकर्ता मेटाउन सकिएन।');
    }
  });

  // Sync / Save user
  app.post(['/api/users', '/api/users/sync'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const saved = await saveUser(req.body);
      res.json({ success: true, user: sanitizeUser(saved) });
    } catch (error: any) {
      sendErrorResponse(res, error, 'प्रयोगकर्ता सुरक्षित गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'प्रयोगकर्ताहरू ब्याच सिंक गर्न सकिएन।');
    }
  });

  // Office-scoped users
  app.get(['/api/offices/:orgId/users', '/api/organizations/:orgId/users'], optionalAuth, async (req, res) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) throw new Error('orgId is required');
      const usersList = await listUsersByOrganization(orgId);
      res.json({ success: true, orgId, users: usersList.map(sanitizeUser) });
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
      res.json({ success: true, orgId, user: sanitizeUser(saved) });
    } catch (error: any) {
      sendErrorResponse(res, error, 'कार्यालयको प्रयोगकर्ता सुरक्षित गर्न सकिएन।');
    }
  });

  const updateOfficeUserHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const { orgId, uid } = req.params;
      const existing = await getUserByUid(uid);
      const merged = { ...(existing || {}), ...req.body, uid, organizationId: orgId };
      const saved = await saveUser(merged);
      res.json({ success: true, orgId, user: sanitizeUser(saved) });
    } catch (error: any) {
      sendErrorResponse(res, error, 'प्रयोगकर्ता अपडेट गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'प्रयोगकर्ता मेटाउन सकिएन।');
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
      sendErrorResponse(res, error, 'आर्थिक वर्ष डाटाबेस सुरक्षित गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'कार्यालय डाटा सुरक्षित गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'प्रणाली सेटिङ सुरक्षित गर्न सकिएन।');
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
      sendErrorResponse(res, error, 'कर्मचारी विवरण सुरक्षित गर्न सकिएन।');
    }
  });

  // Delete fiscal year
  app.delete(['/api/offices/:orgId/fiscal-years/:fy', '/api/organizations/:orgId/fiscal-years/:fy'], optionalAuth, async (req, res) => {
    try {
      const { orgId, fy } = req.params;
      const decodedFy = decodeURIComponent(fy);
      await deleteOrgFiscalYear(orgId, decodedFy);
      res.json({ success: true, message: `Fiscal year ${decodedFy} deleted` });
    } catch (error: any) {
      sendErrorResponse(res, error, 'आर्थिक वर्ष मेटाउन सकिएन।');
    }
  });

  // Clear fiscal year data (all employees and setups for that FY)
  app.post(['/api/offices/:orgId/fiscal-years/:fy/clear', '/api/organizations/:orgId/fiscal-years/:fy/clear'], optionalAuth, async (req, res) => {
    try {
      const { orgId, fy } = req.params;
      const decodedFy = decodeURIComponent(fy);
      await clearOrgFiscalYearData(orgId, decodedFy);
      res.json({ success: true, message: `Fiscal year ${decodedFy} data cleared` });
    } catch (error: any) {
      sendErrorResponse(res, error, 'आर्थिक वर्ष डाटा रिसेट गर्न सकिएन।');
    }
  });

  // System Full Clear / Factory Reset endpoint
  app.post(['/api/system/clear-all', '/api/system/factory-reset'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      console.log('[System] Executing All Clear / Factory Reset requested by:', req.user?.email || 'admin');
      
      // 1. Clear local memory and file store
      localClearAllData();

      // 2. Clear all offices from Firestore and SQL
      await clearAllOffices();

      // 3. Clear non-superadmin users
      await clearAllUsers(true);

      // 4. Re-initialize base superadmin accounts
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

      res.json({
        success: true,
        message: 'सम्पूर्ण प्रणाली डाटा (All Clear / Factory Reset) सफलतापूर्वक खाली गरियो।',
      });
    } catch (error: any) {
      console.error('[System] Factory reset failed:', error);
      res.status(500).json({ error: error.message || 'डाटा खाली गर्न सकिएन।' });
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

    // Ensure credentials exist in user_credentials for bootstrap accounts
    const bootstrapAccounts = [
      { uid: 'user_super_admin', username: 'superadmin', pass: 'admin123' },
      { uid: 'rbthapamgr09', username: 'rbthapamgr09', pass: 'admin123' },
      { uid: 'user_admin_mbp', username: 'admin_mbp', pass: 'admin123' },
    ];
    for (const acc of bootstrapAccounts) {
      try {
        const c = await getUserCredentials(acc.uid);
        if (!c) {
          await setUserCredentials(acc.uid, acc.username, acc.pass, false);
        }
      } catch {}
    }

    console.log('[Bootstrap] Core database verification completed.');
  } catch (err) {
    console.warn('[Bootstrap] Database initialization note:', err);
  }
}

startServer();
