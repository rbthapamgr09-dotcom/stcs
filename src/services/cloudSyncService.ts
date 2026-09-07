import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleSheetsConfig, OrganizationSetup, User } from '../types';

// Initialize Firebase App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

export interface CloudAppConnectionData {
  webAppUrl?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  connectedAccountEmail?: string;
  autoSync?: boolean;
  syncMode?: 'auto' | 'manual';
  organization?: OrganizationSetup;
  activeOrgId?: string;
  updatedAt?: string;
  lastUpdatedBy?: string;
}

const CONNECTIONS_COLLECTION = 'system_connections';
const MAIN_CONFIG_DOC = 'active_payroll_config';
const USERS_COLLECTION = 'system_users';
const MAIN_USERS_DOC = 'registered_accounts';

/**
 * Persists active Google Sheets connection and organization profile to Cloud SQL and Cloud Firestore
 */
export async function saveCloudAppConnection(
  config: GoogleSheetsConfig,
  organization?: OrganizationSetup,
  activeOrgId?: string,
  updatedBy?: string
): Promise<boolean> {
  const data: CloudAppConnectionData = {
    webAppUrl: (config.webAppUrl || '').trim(),
    spreadsheetId: (config.spreadsheetId || '').trim(),
    spreadsheetUrl: (config.spreadsheetUrl || '').trim(),
    spreadsheetName: (config.spreadsheetName || '').trim(),
    connectedAccountEmail: (config.connectedAccountEmail || '').trim(),
    autoSync: config.autoSync ?? true,
    syncMode: config.syncMode || 'auto',
    organization: organization || undefined,
    activeOrgId: activeOrgId || 'org_default',
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy || 'system',
  };

  // 1. Sync to Cloud SQL via backend API
  try {
    await fetch('/api/settings/active_payroll_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, updatedBy }),
    });

    if (organization) {
      await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...organization, id: activeOrgId || 'org_default' }),
      });
    }
  } catch (sqlErr) {
    console.warn('Could not save connection to Cloud SQL API:', sqlErr);
  }

  // 2. Sync to Firestore for multi-device fallback
  try {
    const configDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    await setDoc(configDocRef, data, { merge: true });

    if (updatedBy) {
      const userDocRef = doc(db, CONNECTIONS_COLLECTION, `user_${updatedBy.toLowerCase()}`);
      await setDoc(userDocRef, data, { merge: true });
    }
    return true;
  } catch (err) {
    console.warn('Could not save connection to Cloud Firestore:', err);
    return true; // Cloud SQL may have already succeeded
  }
}

/**
 * Retrieves the persisted Google Sheets connection from Cloud SQL or Firestore.
 */
export async function getCloudAppConnection(
  userIdOrUsername?: string
): Promise<CloudAppConnectionData | null> {
  // 1. Try fetching from Cloud SQL backend API
  try {
    const res = await fetch('/api/settings/active_payroll_config');
    if (res.ok) {
      const json = await res.json();
      if (json.data && (json.data.webAppUrl || json.data.spreadsheetId || json.data.organization)) {
        return json.data as CloudAppConnectionData;
      }
    }
  } catch (sqlErr) {
    console.warn('Could not fetch connection from Cloud SQL API:', sqlErr);
  }

  // 2. Try Firestore fallback
  try {
    if (userIdOrUsername) {
      const userDocRef = doc(db, CONNECTIONS_COLLECTION, `user_${userIdOrUsername.toLowerCase()}`);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const d = userSnap.data() as CloudAppConnectionData;
        if (d.webAppUrl || d.spreadsheetId) {
          return d;
        }
      }
    }

    const mainDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    const mainSnap = await getDoc(mainDocRef);
    if (mainSnap.exists()) {
      return mainSnap.data() as CloudAppConnectionData;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch connection from Cloud Firestore:', err);
    return null;
  }
}

/**
 * Persists registered users list to Cloud SQL and Firestore
 */
export async function saveCloudUsers(usersList: User[]): Promise<boolean> {
  // 1. Sync users to Cloud SQL
  try {
    for (const u of usersList) {
      await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: u.id || u.username,
          email: u.email || '',
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          organizationId: u.organizationId,
          metadata: {
            phone: u.phone,
            designation: u.designation,
            isActive: u.isActive,
          },
        }),
      });
    }
  } catch (sqlErr) {
    console.warn('Could not sync users to Cloud SQL:', sqlErr);
  }

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    await setDoc(docRef, {
      users: usersList,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('Could not save users to Cloud Firestore:', err);
    return true;
  }
}

/**
 * Fetches registered users list from Cloud SQL or Firestore.
 */
export async function getCloudUsers(): Promise<User[] | null> {
  // 1. Try Cloud SQL
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.users) && json.users.length > 0) {
        return json.users.map((u: any) => ({
          id: u.uid || String(u.id),
          username: u.username,
          fullName: u.fullName || u.full_name,
          email: u.email,
          role: u.role || 'GENERAL_USER',
          organizationId: u.organizationId || u.organization_id || 'org_default',
          organizationName: u.organizationName || u.organization_name,
          designation: u.designation,
          phone: u.phone,
          isActive: u.isActive ?? u.is_active ?? true,
          createdAt: u.createdAt || u.created_at || new Date().toISOString(),
        })) as User[];
      }
    }
  } catch (sqlErr) {
    console.warn('Could not fetch users from Cloud SQL:', sqlErr);
  }

  // 2. Try Firestore fallback
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.users) && data.users.length > 0) {
        return data.users as User[];
      }
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch users from Cloud Firestore:', err);
    return null;
  }
}
