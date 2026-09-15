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
  delete dbState.users[uid];
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
