import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUsers, getUserByUid, deleteUserByUid } from './src/db/users.ts';
import {
  getOrganizations,
  upsertOrganization,
  getSystemSetting,
  setSystemSetting,
  getEmployees,
  upsertEmployee,
} from './src/db/payroll.ts';

async function startServer() {
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

  // User synchronization & authentication endpoint
  app.post('/api/users/sync', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email, username, fullName, role, organizationId, metadata } = req.body;
      const targetUid = req.user?.uid || uid;
      const targetEmail = req.user?.email || email;

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

  // Organization settings
  app.get('/api/organization', optionalAuth, async (_req, res) => {
    try {
      const orgs = await getOrganizations();
      res.json({ success: true, organizations: orgs });
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch organization' });
    }
  });

  app.post('/api/organization', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const saved = await upsertOrganization(req.body);
      res.json({ success: true, organization: saved });
    } catch (error: any) {
      console.error('Failed to save organization:', error);
      res.status(500).json({ error: error.message || 'Failed to save organization' });
    }
  });

  // System Settings (Google Sheets connection, payroll state, etc.)
  app.get('/api/settings/:key', optionalAuth, async (req, res) => {
    try {
      const data = await getSystemSetting(req.params.key);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error(`Failed to get setting ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to fetch setting' });
    }
  });

  app.post('/api/settings/:key', optionalAuth, async (req: AuthRequest, res) => {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
