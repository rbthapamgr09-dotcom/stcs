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
} from './src/db/users.ts';
import { verifyPasswordSync } from './src/utils/securityUtils.ts';
import {
  getOrganizations,
  upsertOrganization,
  deleteOrganizationById,
  getSystemSetting,
  setSystemSetting,
  getEmployees,
  upsertEmployee,
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
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || 'org_default',
        organizationName: user.organizationName || meta.organizationName,
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

  // Data directory and local files for cross-device shared config without Cloud SQL / Firestore
  const DATA_DIR = path.join(process.cwd(), 'data');
  const ORGS_FILE = path.join(DATA_DIR, 'organizations.json');

  function readLocalOrgs(): any[] {
    try {
      if (fs.existsSync(ORGS_FILE)) {
        const content = fs.readFileSync(ORGS_FILE, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('readLocalOrgs error:', e);
    }
    return [];
  }

  function writeLocalOrgs(orgs: any[]): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ORGS_FILE, JSON.stringify(orgs, null, 2), 'utf8');
    } catch (e) {
      console.warn('writeLocalOrgs error:', e);
    }
  }

  // Google Sheets Web App Proxy endpoint (Bypasses any client-side CORS / network restrictions)
  app.post('/api/sheets/proxy', async (req, res) => {
    try {
      const { targetUrl, payload } = req.body;
      if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ success: false, message: 'targetUrl is required' });
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload || {}),
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: response.ok, rawText: text };
      }
      res.status(response.status).json(data);
    } catch (proxyErr: any) {
      console.error('Sheets proxy error:', proxyErr);
      res.status(500).json({ success: false, message: proxyErr.message || 'Sheets proxy failed' });
    }
  });

  // Organization settings (Shared cross-device via local JSON and/or DB)
  app.get(['/api/organization', '/api/organizations'], optionalAuth, async (_req, res) => {
    try {
      let dbOrgs: any[] = [];
      try {
        dbOrgs = await getOrganizations();
      } catch {
        // Fallback when DB is not configured
      }

      const localOrgs = readLocalOrgs();
      const mergedMap = new Map();

      for (const o of localOrgs) {
        if (o && o.id) mergedMap.set(o.id, o);
      }
      for (const o of dbOrgs) {
        if (o && o.id) {
          const existing = mergedMap.get(o.id) || {};
          mergedMap.set(o.id, { ...existing, ...o });
        }
      }

      const finalOrgs = Array.from(mergedMap.values());
      res.json({ success: true, organizations: finalOrgs.length > 0 ? finalOrgs : localOrgs });
    } catch (error: any) {
      const localOrgs = readLocalOrgs();
      res.json({ success: true, organizations: localOrgs });
    }
  });

  app.post(['/api/organization', '/api/organizations'], optionalAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body;
      const orgId = body.id || `org_${Date.now()}`;
      const updatedOrg = { ...body, id: orgId, updatedAt: new Date().toISOString() };

      // 1. Always update local JSON file
      const localOrgs = readLocalOrgs();
      const idx = localOrgs.findIndex((o) => o.id === orgId);
      if (idx >= 0) {
        localOrgs[idx] = { ...localOrgs[idx], ...updatedOrg };
      } else {
        localOrgs.push(updatedOrg);
      }
      writeLocalOrgs(localOrgs);

      // 2. Try DB if available
      let saved = updatedOrg;
      try {
        saved = await upsertOrganization(body);
      } catch {}

      res.json({ success: true, organization: saved || updatedOrg });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save organization' });
    }
  });

  app.post('/api/organizations/batch', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const list = req.body.organizations || req.body;
      if (Array.isArray(list)) {
        writeLocalOrgs(list);
      }
      res.json({ success: true, message: 'Organizations synced locally' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete(['/api/organization/:id', '/api/organizations/:id'], optionalAuth, async (req, res) => {
    try {
      const targetId = req.params.id;
      const localOrgs = readLocalOrgs().filter((o) => o.id !== targetId);
      writeLocalOrgs(localOrgs);

      try {
        await deleteOrganizationById(targetId);
      } catch {}

      res.json({ success: true, message: 'Organization deleted successfully' });
    } catch (error: any) {
      console.error('Failed to delete organization:', error);
      res.status(500).json({ error: error.message || 'Failed to delete organization' });
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

startServer();
