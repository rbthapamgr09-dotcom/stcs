import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let adminAppInstance: App | null = null;
let adminAuthInstance: ReturnType<typeof getAuth> | null = null;
let adminDbInstance: Firestore | null = null;
let activeDatabaseId = 'ai-studio-0e40d00e-d249-4cfb-9b34-c114c9ca9db6';

function initFirebaseAdmin(): { app: App; dbId: string } {
  if (!adminAppInstance) {
    let projectId = process.env.FIREBASE_PROJECT_ID;
    let databaseId = 'ai-studio-0e40d00e-d249-4cfb-9b34-c114c9ca9db6';

    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw);
        projectId = projectId || config.projectId;
        if (config.firestoreDatabaseId) {
          databaseId = config.firestoreDatabaseId;
        }
      }
    } catch (e) {
      console.warn('[Firebase Admin] Could not read firebase-applet-config.json:', e);
    }

    activeDatabaseId = databaseId;

    if (!getApps().length) {
      adminAppInstance = initializeApp({
        projectId: projectId || 'inner-volt-dxfhk',
      });
    } else {
      adminAppInstance = getApps()[0] as App;
    }

    console.log(`[Firebase Admin] Bootstrapped with Firestore named database: ${activeDatabaseId}`);
  }
  return { app: adminAppInstance, dbId: activeDatabaseId };
}

export function getAdminAuth(): ReturnType<typeof getAuth> {
  if (!adminAuthInstance) {
    const { app } = initFirebaseAdmin();
    adminAuthInstance = getAuth(app);
  }
  return adminAuthInstance;
}

export function getAdminDb(): Firestore {
  if (!adminDbInstance) {
    const { app, dbId } = initFirebaseAdmin();
    adminDbInstance = getFirestore(app, dbId);
  }
  return adminDbInstance;
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop) {
    const auth = getAdminAuth();
    return (auth as any)[prop];
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = getAdminDb();
    return (db as any)[prop];
  },
});

export const FIRESTORE_DATABASE_ID = activeDatabaseId;
