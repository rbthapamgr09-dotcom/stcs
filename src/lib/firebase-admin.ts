import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let adminAuthInstance: ReturnType<typeof getAuth> | null = null;

export function getAdminAuth() {
  if (!adminAuthInstance) {
    if (!getApps().length) {
      let projectId = process.env.FIREBASE_PROJECT_ID;
      try {
        const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const raw = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(raw);
          projectId = projectId || config.projectId;
        }
      } catch (e) {
        console.warn('Could not read firebase-applet-config.json:', e);
      }
      initializeApp({
        projectId: projectId || 'inner-volt-dxfhk',
      });
    }
    adminAuthInstance = getAuth();
  }
  return adminAuthInstance;
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop) {
    const auth = getAdminAuth();
    return (auth as any)[prop];
  },
});

