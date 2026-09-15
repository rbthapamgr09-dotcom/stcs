import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
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

  return null;
}

export async function setSystemSetting(key: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!key) throw new Error('Setting key is required.');
  let firestoreSaved = false;

  // 1. Firestore
  try {
    await adminDb.collection('system_settings').doc(key).set({
      key,
      data,
      updatedBy,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    firestoreSaved = true;
  } catch (err: any) {
    console.warn(`[SettingsRepo] Firestore write error for setting ${key}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      await sqlSetSystemSetting(key, data, updatedBy);
    } catch (sqlErr: any) {
      console.warn(`[SettingsRepo] SQL mirror error for setting ${key}:`, sqlErr?.message || sqlErr);
      if (!firestoreSaved) {
        throw new Error(`Failed to persist setting to both Firestore and SQL: ${sqlErr.message}`);
      }
    }
  } else if (!firestoreSaved) {
    throw new Error('Could not persist setting: Firestore is unavailable and SQL is disabled.');
  }

  return { key, data, updatedBy, updatedAt: new Date().toISOString() };
}
