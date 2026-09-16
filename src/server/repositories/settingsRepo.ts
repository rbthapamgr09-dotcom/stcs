import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import { withFirestore, PersistenceError } from './firestoreGuard.ts';
import { assertUnderLimit } from '../utils/chunking.ts';
import { localGetSetting, localSetSetting } from './localStore.ts';
import {
  getSystemSetting as sqlGetSystemSetting,
  setSystemSetting as sqlSetSystemSetting,
} from '../../db/payroll.ts';

export async function getSystemSetting(key: string): Promise<any> {
  if (!key) return null;

  // 1. Firestore
  try {
    const docSnap = await withFirestore('getSystemSetting', async () => {
      return await adminDb.collection('system_settings').doc(key).get();
    }, { retries: 1, timeoutMs: 5000 });

    if (docSnap.exists) {
      const data = docSnap.data();
      return data?.data !== undefined ? data.data : data;
    }
  } catch (err: any) {
    console.warn(`[SettingsRepo] Firestore read error for setting ${key}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlData = await sqlGetSystemSetting(key);
      if (sqlData !== null && sqlData !== undefined) return sqlData;
    } catch (sqlErr: any) {
      console.warn(`[SettingsRepo] SQL read error for setting ${key}:`, sqlErr?.message || sqlErr);
    }
  }

  // 3. Local fallback
  return localGetSetting(key);
}

export async function setSystemSetting(key: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!key) throw new Error('Setting key is required.');

  assertUnderLimit(data, 800_000, `प्रणाली सेटिङ (${key})`);

  const persistedTo: string[] = [];

  // 1. Primary Firestore write via withFirestore
  await withFirestore('setSystemSetting', async () => {
    await adminDb.collection('system_settings').doc(key).set({
      key,
      data,
      updatedBy,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
  persistedTo.push('firestore');

  // 2. LocalStore cache persistence (ONLY after Firestore confirms)
  try {
    localSetSetting(key, data);
    persistedTo.push('local');
  } catch (localErr: any) {
    console.warn(`[SettingsRepo] Local cache write notice for setting ${key}:`, localErr?.message || localErr);
  }

  // 3. Mirror to Cloud SQL if operational
  if (await isSqlEnabled()) {
    try {
      await sqlSetSystemSetting(key, data, updatedBy);
      persistedTo.push('sql');
    } catch (sqlErr: any) {
      console.warn(`[SettingsRepo] SQL mirror notice for setting ${key}:`, sqlErr?.message || sqlErr);
    }
  }

  const result = { key, data, updatedBy, updatedAt: new Date().toISOString() };
  return Object.assign({ entity: result, persistedTo }, result);
}
