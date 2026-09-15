import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import {
  getOrgFyDatabase as sqlGetOrgFyDatabase,
  setOrgFyDatabase as sqlSetOrgFyDatabase,
  getOrgDataStore as sqlGetOrgDataStore,
  setOrgDataStore as sqlSetOrgDataStore,
  getEmployees as sqlGetEmployees,
  upsertEmployee as sqlUpsertEmployee,
} from '../../db/payroll.ts';

export async function getOrgFyDatabase(orgId: string): Promise<Record<string, any> | null> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get fiscal year database.');
  }

  let fyData: Record<string, any> = {};
  let foundInFirestore = false;

  // 1. Try reading individual fiscal year docs from Firestore
  try {
    const snap = await adminDb.collection('offices').doc(orgId).collection('fiscal_years').get();
    if (!snap.empty) {
      snap.forEach((doc) => {
        fyData[doc.id] = doc.data();
      });
      foundInFirestore = true;
    } else {
      // Also check if stored as a document in data/fy_database
      const docSnap = await adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database').get();
      if (docSnap.exists) {
        fyData = docSnap.data()?.data || docSnap.data() || {};
        foundInFirestore = true;
      }
    }
  } catch (err: any) {
    console.warn(`[FyRepo] Firestore read error for org ${orgId}:`, err?.message || err);
  }

  if (foundInFirestore && Object.keys(fyData).length > 0) {
    return fyData;
  }

  // 2. Fallback to SQL
  if (await isSqlEnabled()) {
    try {
      const sqlData = await sqlGetOrgFyDatabase(orgId);
      if (sqlData) return sqlData;
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL read error for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  return foundInFirestore ? fyData : null;
}

export async function setOrgFyDatabase(orgId: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save fiscal year database.');
  }

  let firestoreSaved = false;

  // 1. Write to Firestore
  try {
    // Write the full blob to data/fy_database
    await adminDb
      .collection('offices')
      .doc(orgId)
      .collection('data')
      .doc('fy_database')
      .set({
        data,
        updatedBy,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

    // Also write per-fiscal-year documents if data is a map of fiscal years
    if (data && typeof data === 'object') {
      const batch = adminDb.batch();
      for (const [fy, val] of Object.entries(data)) {
        if (fy && typeof val === 'object') {
          const docRef = adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fy);
          batch.set(docRef, {
            ...(val as any),
            fiscalYear: fy,
            officeId: orgId,
            updatedBy,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
      await batch.commit();
    }
    firestoreSaved = true;
  } catch (err: any) {
    console.warn(`[FyRepo] Firestore write error for org ${orgId}:`, err?.message || err);
  }

  // 2. Mirror to SQL
  if (await isSqlEnabled()) {
    try {
      await sqlSetOrgFyDatabase(orgId, data, updatedBy);
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL mirror error for org ${orgId}:`, sqlErr?.message || sqlErr);
      if (!firestoreSaved) {
        throw new Error(`Failed to persist FY database to both Firestore and SQL: ${sqlErr.message}`);
      }
    }
  } else if (!firestoreSaved) {
    throw new Error('Could not persist FY database: Firestore is unavailable and SQL is disabled.');
  }

  return { success: true, orgId };
}

export async function getOrgDataStore(orgId: string): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get organization store.');
  }

  // 1. Firestore
  try {
    const docSnap = await adminDb.collection('offices').doc(orgId).collection('data').doc('store').get();
    if (docSnap.exists) {
      return docSnap.data()?.data || docSnap.data();
    }
  } catch (err: any) {
    console.warn(`[FyRepo] Firestore store read error for org ${orgId}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlStore = await sqlGetOrgDataStore(orgId);
      if (sqlStore) return sqlStore;
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL store read error for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  return null;
}

export async function setOrgDataStore(orgId: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save organization store.');
  }

  let firestoreSaved = false;

  // 1. Firestore
  try {
    await adminDb
      .collection('offices')
      .doc(orgId)
      .collection('data')
      .doc('store')
      .set({
        data,
        updatedBy,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    firestoreSaved = true;
  } catch (err: any) {
    console.warn(`[FyRepo] Firestore store write error for org ${orgId}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      await sqlSetOrgDataStore(orgId, data, updatedBy);
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL store mirror error for org ${orgId}:`, sqlErr?.message || sqlErr);
      if (!firestoreSaved) {
        throw new Error(`Failed to persist store to both Firestore and SQL: ${sqlErr.message}`);
      }
    }
  } else if (!firestoreSaved) {
    throw new Error('Could not persist store: Firestore is unavailable and SQL is disabled.');
  }

  return { success: true, orgId };
}

export async function getEmployees(orgId: string): Promise<any[]> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get employees.');
  }

  if (await isSqlEnabled()) {
    try {
      return await sqlGetEmployees(orgId);
    } catch (err: any) {
      console.warn(`[FyRepo] SQL getEmployees error for org ${orgId}:`, err?.message || err);
    }
  }
  return [];
}

export async function upsertEmployee(employee: any, orgId: string): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save employee.');
  }

  if (await isSqlEnabled()) {
    try {
      return await sqlUpsertEmployee(employee, orgId);
    } catch (err: any) {
      console.warn(`[FyRepo] SQL upsertEmployee error for org ${orgId}:`, err?.message || err);
    }
  }
  return employee;
}
