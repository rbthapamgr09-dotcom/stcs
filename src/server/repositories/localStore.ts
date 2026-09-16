import fs from 'fs';
import path from 'path';

interface LocalDatabaseSchema {
  offices: Record<string, any>;
  users: Record<string, any>;
  settings: Record<string, any>;
  fyDatabases: Record<string, any>;
  orgStores: Record<string, any>;
  employees: Record<string, any>;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'app-database.json');

let dbState: LocalDatabaseSchema = {
  offices: {},
  users: {},
  settings: {},
  fyDatabases: {},
  orgStores: {},
  employees: {},
};

let isLoaded = false;
let saveTimeout: NodeJS.Timeout | null = null;

function ensureLoaded() {
  if (isLoaded) return;
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      dbState = {
        offices: parsed.offices || {},
        users: parsed.users || {},
        settings: parsed.settings || {},
        fyDatabases: parsed.fyDatabases || {},
        orgStores: parsed.orgStores || {},
        employees: parsed.employees || {},
      };
    }
  } catch (e) {
    console.warn('[LocalStore] Could not read app-database.json:', e);
  }
  isLoaded = true;
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[LocalStore] Failed to write app-database.json:', e);
    }
  }, 100);
}

// Offices
export function localSaveOffice(office: any): void {
  ensureLoaded();
  if (!office?.id) return;
  dbState.offices[office.id] = { ...office, updatedAt: new Date().toISOString() };
  scheduleSave();
}

export function localGetOffice(id: string): any | null {
  ensureLoaded();
  return dbState.offices[id] || null;
}

export function localListOffices(): any[] {
  ensureLoaded();
  return Object.values(dbState.offices);
}

export function localDeleteOffice(id: string): void {
  ensureLoaded();
  delete dbState.offices[id];
  scheduleSave();
}

// Users
export function localSaveUser(user: any): void {
  ensureLoaded();
  if (!user?.uid) return;
  dbState.users[user.uid] = { ...user, updatedAt: new Date().toISOString() };
  scheduleSave();
}

export function localGetUserByUid(uid: string): any | null {
  ensureLoaded();
  return dbState.users[uid] || null;
}

export function localGetUserByUsername(username: string): any | null {
  ensureLoaded();
  const lower = username.toLowerCase().trim();
  return Object.values(dbState.users).find(
    (u: any) => u.username?.toLowerCase() === lower || u.email?.toLowerCase() === lower
  ) || null;
}

export function localListUsers(): any[] {
  ensureLoaded();
  return Object.values(dbState.users);
}

export function localDeleteUser(uid: string): void {
  ensureLoaded();
  if (!uid) return;
  const clean = uid.toLowerCase().trim();
  
  // 1. Delete from direct key
  delete dbState.users[uid];

  // 2. Scan all entries in dbState.users
  for (const [key, user] of Object.entries(dbState.users)) {
    const u = user as any;
    if (
      key === uid ||
      u.uid === uid ||
      u.id === uid ||
      u.username?.toLowerCase() === clean ||
      u.email?.toLowerCase() === clean
    ) {
      delete dbState.users[key];
    }
  }

  // 3. Scan dbState.orgStores
  for (const [orgKey, store] of Object.entries(dbState.orgStores)) {
    const s = store as any;
    if (Array.isArray(s?.users)) {
      s.users = s.users.filter(
        (u: any) =>
          u.uid !== uid &&
          u.id !== uid &&
          u.username?.toLowerCase() !== clean &&
          u.email?.toLowerCase() !== clean
      );
    }
  }

  scheduleSave();
}

// Settings
export function localGetSetting(key: string): any {
  ensureLoaded();
  return dbState.settings[key] !== undefined ? dbState.settings[key] : null;
}

export function localSetSetting(key: string, data: any): void {
  ensureLoaded();
  dbState.settings[key] = data;
  scheduleSave();
}

// FY Database
export function localGetFyDatabase(orgId: string): Record<string, any> | null {
  ensureLoaded();
  return dbState.fyDatabases[orgId] || null;
}

export function localSetFyDatabase(orgId: string, data: any): void {
  ensureLoaded();
  dbState.fyDatabases[orgId] = data;
  scheduleSave();
}

// Org Stores
export function localGetOrgStore(orgId: string): any | null {
  ensureLoaded();
  return dbState.orgStores[orgId] || null;
}

export function localSetOrgStore(orgId: string, store: any): void {
  ensureLoaded();
  dbState.orgStores[orgId] = store;
  scheduleSave();
}

// Employees
export function localGetEmployees(orgId: string, fiscalYear?: string): any[] {
  ensureLoaded();
  const orgEmployees = dbState.employees[orgId] || {};
  if (fiscalYear) {
    return orgEmployees[fiscalYear] || [];
  }
  const all: any[] = [];
  for (const list of Object.values(orgEmployees)) {
    if (Array.isArray(list)) all.push(...list);
  }
  return all;
}

export function localSaveEmployee(orgId: string, fiscalYear: string, employee: any): void {
  ensureLoaded();
  if (!dbState.employees[orgId]) dbState.employees[orgId] = {};
  if (!dbState.employees[orgId][fiscalYear]) dbState.employees[orgId][fiscalYear] = [];

  const list: any[] = dbState.employees[orgId][fiscalYear];
  const idx = list.findIndex((e) => e.id === employee.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...employee, updatedAt: new Date().toISOString() };
  } else {
    list.push({ ...employee, updatedAt: new Date().toISOString() });
  }
  scheduleSave();
}

export function localDeleteFiscalYear(orgId: string, fiscalYear: string): void {
  ensureLoaded();
  if (dbState.fyDatabases[orgId] && dbState.fyDatabases[orgId][fiscalYear]) {
    delete dbState.fyDatabases[orgId][fiscalYear];
  }
  if (dbState.employees[orgId] && dbState.employees[orgId][fiscalYear]) {
    delete dbState.employees[orgId][fiscalYear];
  }
  scheduleSave();
}

export function localClearFiscalYear(orgId: string, fiscalYear: string): void {
  ensureLoaded();
  if (dbState.fyDatabases[orgId]) {
    dbState.fyDatabases[orgId][fiscalYear] = {
      employees: [],
      salarySetups: {},
      deductionSetups: {},
      taxReferences: [],
    };
  }
  if (dbState.employees[orgId]) {
    dbState.employees[orgId][fiscalYear] = [];
  }
  scheduleSave();
}

export function localClearAllData(): void {
  ensureLoaded();
  dbState = {
    offices: {},
    users: {},
    settings: {},
    fyDatabases: {},
    orgStores: {},
    employees: {},
  };
  scheduleSave();
}

export function localStoreEntriesCount(): number {
  ensureLoaded();
  return (
    Object.keys(dbState.offices).length +
    Object.keys(dbState.users).length +
    Object.keys(dbState.settings).length +
    Object.keys(dbState.fyDatabases).length +
    Object.keys(dbState.orgStores).length +
    Object.keys(dbState.employees).length
  );
}

export async function syncLocalStoreFromFirestore(adminDb: any): Promise<void> {
  ensureLoaded();
  try {
    // 1. Sync offices
    const officesSnap = await adminDb.collection('offices').get();
    officesSnap.forEach((doc: any) => {
      const data = doc.data();
      if (data && doc.id) {
        dbState.offices[doc.id] = { ...data, id: doc.id };
      }
    });

    // 2. Sync users
    const usersSnap = await adminDb.collection('users').get();
    usersSnap.forEach((doc: any) => {
      const data = doc.data();
      if (data && (data.uid || doc.id)) {
        const uid = data.uid || doc.id;
        dbState.users[uid] = { ...data, uid };
      }
    });

    // 3. Sync system settings
    const settingsSnap = await adminDb.collection('system_settings').get();
    settingsSnap.forEach((doc: any) => {
      const data = doc.data();
      if (data) {
        dbState.settings[doc.id] = data?.data !== undefined ? data.data : data;
      }
    });

    scheduleSave();
    console.log(`[LocalStore] Populated cache from Firestore: ${Object.keys(dbState.offices).length} offices, ${Object.keys(dbState.users).length} users, ${Object.keys(dbState.settings).length} settings.`);
  } catch (err: any) {
    console.warn('[LocalStore] Could not bootstrap cache from Firestore:', err?.message || err);
  }
}
