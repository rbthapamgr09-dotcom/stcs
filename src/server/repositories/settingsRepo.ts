import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import { localGetSetting, localSetSetting } from './localStore.ts';
import {
  getSystemSetting as sqlGetSystemSetting,
  setSystemSetting as sqlSetSystemSetting,
} from '../../db/payroll.ts';

export async function getSystemSetting(key: string): Promise<any> {
  if (!key) return null;

  // 1. Firestore
  try {
    const docSnap = await adminDb.collection('system_settings').doc(key).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data?.data !== undefined ? data.data : data;
    }
  } catch (err: any) {
    // Fallback
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlData = await sqlGetSystemSetting(key);
      if (sqlData !== null && sqlData !== undefined) return sqlData;
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. Local fallback
  return localGetSetting(key);
}

export async function setSystemSetting(key: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!key) throw new Error('Setting key is required.');

  // 1. LocalStore persistence
  localSetSetting(key, data);

  // 2. Best-effort Firestore write
  try {
    await adminDb.collection('system_settings').doc(key).set({
      key,
      data,
      updatedBy,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err: any) {
    // Handled
  }

  // 3. Best-effort SQL write
  if (await isSqlEnabled()) {
    try {
      await sqlSetSystemSetting(key, data, updatedBy);
    } catch (sqlErr: any) {
      console.warn(`[SettingsRepo] SQL mirror notice for setting ${key}:`, sqlErr?.message || sqlErr);
    }
  }

  return { key, data, updatedBy, updatedAt: new Date().toISOString() };
}
