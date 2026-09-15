import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import {
  localGetFyDatabase,
  localSetFyDatabase,
  localGetOrgStore,
  localSetOrgStore,
  localGetEmployees,
  localSaveEmployee,
  localDeleteFiscalYear,
  localClearFiscalYear,
} from './localStore.ts';
import {
  getOrgFyDatabase as sqlGetOrgFyDatabase,
  setOrgFyDatabase as sqlSetOrgFyDatabase,
  getOrgDataStore as sqlGetOrgDataStore,
  setOrgDataStore as sqlSetOrgDataStore,
  getEmployees as sqlGetEmployees,
  upsertEmployee as sqlUpsertEmployee,
} from '../../db/payroll.ts';

export function slugifyFiscalYear(fy: string): string {
  return (fy || 'default_fy').replace(/\//g, '_').replace(/\s+/g, '').trim();
}

export async function getOrgFyDatabase(orgId: string): Promise<Record<string, any> | null> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get fiscal year database.');
  }

  let fyData: Record<string, any> = {};
  let foundInFirestore = false;

  // 1. Try reading from Firestore
  try {
    const snap = await adminDb.collection('offices').doc(orgId).collection('fiscal_years').get();
    if (!snap.empty) {
      snap.forEach((doc) => {
        const data = doc.data();
        const fyKey = data.fiscalYear || doc.id;
        fyData[fyKey] = data;
      });
      foundInFirestore = true;
    } else {
      const docSnap = await adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database').get();
      if (docSnap.exists) {
        fyData = docSnap.data()?.data || docSnap.data() || {};
        foundInFirestore = true;
      }
    }
  } catch (err: any) {
    // Fallback
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
      // Fallback
    }
  }

  // 3. Fallback to localStore
  return localGetFyDatabase(orgId);
}

export async function setOrgFyDatabase(orgId: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save fiscal year database.');
  }

  // 1. LocalStore persistence
  localSetFyDatabase(orgId, data);

  // 2. Best-effort Firestore write
  try {
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

    if (data && typeof data === 'object') {
      const batch = adminDb.batch();
      for (const [fy, val] of Object.entries(data)) {
        if (fy && typeof val === 'object') {
          const fySlug = slugifyFiscalYear(fy);
          const docRef = adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fySlug);
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
  } catch (err: any) {
    // Handled
  }

  // 3. Best-effort SQL mirror
  if (await isSqlEnabled()) {
    try {
      await sqlSetOrgFyDatabase(orgId, data, updatedBy);
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL mirror notice for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
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
    // Fallback
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlStore = await sqlGetOrgDataStore(orgId);
      if (sqlStore) return sqlStore;
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. Local fallback
  return localGetOrgStore(orgId);
}

export async function setOrgDataStore(orgId: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save organization store.');
  }

  // 1. LocalStore persistence
  localSetOrgStore(orgId, data);

  // 2. Best-effort Firestore write
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
  } catch (err: any) {
    // Handled
  }

  // 3. Best-effort SQL write
  if (await isSqlEnabled()) {
    try {
      await sqlSetOrgDataStore(orgId, data, updatedBy);
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL store mirror notice for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  return { success: true, orgId };
}

export async function getEmployees(orgId: string, fiscalYear?: string): Promise<any[]> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get employees.');
  }

  if (await isSqlEnabled()) {
    try {
      const emps = await sqlGetEmployees(orgId);
      if (emps && emps.length > 0) return emps;
    } catch (err: any) {
      // Fallback
    }
  }
  return localGetEmployees(orgId, fiscalYear);
}

export async function upsertEmployee(employee: any, orgId: string, fiscalYear: string = '२०८१/८२'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save employee.');
  }

  localSaveEmployee(orgId, fiscalYear, employee);

  if (await isSqlEnabled()) {
    try {
      return await sqlUpsertEmployee(employee, orgId);
    } catch (err: any) {
      console.warn(`[FyRepo] SQL upsertEmployee notice for org ${orgId}:`, err?.message || err);
    }
  }
  return employee;
}

export async function deleteOrgFiscalYear(orgId: string, fiscalYear: string): Promise<boolean> {
  if (!orgId || !fiscalYear) return false;

  // 1. LocalStore
  localDeleteFiscalYear(orgId, fiscalYear);

  // 2. Firestore
  try {
    const fySlug = slugifyFiscalYear(fiscalYear);
    await adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fySlug).delete();
    await adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fiscalYear).delete();

    // Update parent fy_database doc if present
    const docRef = adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database');
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data()?.data || snap.data() || {};
      delete d[fiscalYear];
      await docRef.set({ data: d, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (err: any) {
    console.warn(`[FyRepo] Error deleting fiscal year ${fiscalYear} for org ${orgId}:`, err?.message || err);
  }

  return true;
}

export async function clearOrgFiscalYearData(orgId: string, fiscalYear: string): Promise<boolean> {
  if (!orgId || !fiscalYear) return false;

  // 1. LocalStore
  localClearFiscalYear(orgId, fiscalYear);

  // 2. Firestore
  try {
    const fySlug = slugifyFiscalYear(fiscalYear);
    const emptyPayload = {
      officeId: orgId,
      fiscalYear,
      employees: [],
      salarySetups: {},
      deductionSetups: {},
      taxReferences: [],
      updatedAt: new Date().toISOString(),
    };
    await adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fySlug).set(emptyPayload);

    const docRef = adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database');
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data()?.data || snap.data() || {};
      d[fiscalYear] = emptyPayload;
      await docRef.set({ data: d, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } catch (err: any) {
    console.warn(`[FyRepo] Error clearing fiscal year data ${fiscalYear} for org ${orgId}:`, err?.message || err);
  }

  return true;
}
