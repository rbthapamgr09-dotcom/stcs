import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import { withFirestore, PersistenceError } from './firestoreGuard.ts';
import { assertUnderLimit, chunkArray } from '../utils/chunking.ts';
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

  // 1. Try reading from Firestore subcollections (modern split schema)
  try {
    const fySnap = await withFirestore('getOrgFyDatabase:list', async () => {
      return await adminDb.collection('offices').doc(orgId).collection('fiscal_years').get();
    }, { retries: 1, timeoutMs: 7000 });

    if (!fySnap.empty) {
      for (const doc of fySnap.docs) {
        const data = doc.data();
        const fyKey = data.fiscalYear || doc.id;

        // Fetch subcollection employees
        try {
          const empSnap = await doc.ref.collection('employees').get();
          if (!empSnap.empty) {
            data.employees = empSnap.docs.map((d) => d.data());
          } else if (!data.employees) {
            data.employees = [];
          }
        } catch (subErr) {
          console.warn(`[FyRepo] Error reading employees subcollection for ${fyKey}:`, subErr);
          if (!data.employees) data.employees = [];
        }

        fyData[fyKey] = data;
      }
      foundInFirestore = true;
    } else {
      // Backward compatibility: read legacy monolithic fy_database document
      const legacySnap = await withFirestore('getOrgFyDatabase:legacy', async () => {
        return await adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database').get();
      }, { retries: 1, timeoutMs: 5000 });

      if (legacySnap.exists) {
        fyData = legacySnap.data()?.data || legacySnap.data() || {};
        foundInFirestore = true;
      }
    }
  } catch (err: any) {
    console.warn(`[FyRepo] Firestore read notice for org ${orgId}:`, err?.message || err);
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
      console.warn(`[FyRepo] SQL read notice for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  // 3. Fallback to localStore
  return localGetFyDatabase(orgId);
}

export async function setOrgFyDatabase(orgId: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save fiscal year database.');
  }

  const persistedTo: string[] = [];

  // 1. Primary write to Firestore with withFirestore
  await withFirestore('setOrgFyDatabase', async () => {
    if (data && typeof data === 'object') {
      for (const [fy, val] of Object.entries(data)) {
        if (fy && typeof val === 'object' && val !== null) {
          const fySlug = slugifyFiscalYear(fy);
          const fyRef = adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fySlug);

          const fyPayload = { ...(val as any) };
          const employees = Array.isArray(fyPayload.employees) ? [...fyPayload.employees] : [];
          
          // Separate employees from main FY document to prevent exceeding 1MB
          delete fyPayload.employees;
          fyPayload.fiscalYear = fy;
          fyPayload.officeId = orgId;
          fyPayload.updatedBy = updatedBy;
          fyPayload.updatedAt = new Date().toISOString();

          assertUnderLimit(fyPayload, 750_000, `आर्थिक वर्ष (${fy})`);

          // Write FY metadata
          await fyRef.set(fyPayload, { merge: true });

          // Chunk-write employees to subcollection (max 400 items per batch)
          if (employees.length > 0) {
            const chunks = chunkArray(employees, 400);
            for (const chunk of chunks) {
              const batch = adminDb.batch();
              for (const emp of chunk) {
                const empId = String(emp.id || emp.employeeId || emp.uid || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
                const empRef = fyRef.collection('employees').doc(empId);
                batch.set(empRef, {
                  ...emp,
                  id: empId,
                  officeId: orgId,
                  fiscalYear: fy,
                  updatedAt: new Date().toISOString(),
                }, { merge: true });
              }
              await batch.commit();
            }
          }
        }
      }
    }
  });
  persistedTo.push('firestore');

  // 2. Cache in localStore (ONLY after Firestore confirms)
  try {
    localSetFyDatabase(orgId, data);
    persistedTo.push('local');
  } catch (localErr: any) {
    console.warn(`[FyRepo] Local store write notice for org ${orgId}:`, localErr?.message || localErr);
  }

  // 3. Mirror to Cloud SQL if enabled
  if (await isSqlEnabled()) {
    try {
      await sqlSetOrgFyDatabase(orgId, data, updatedBy);
      persistedTo.push('sql');
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL mirror notice for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  const result = { success: true, orgId };
  return Object.assign({ entity: result, persistedTo }, result);
}

export async function getOrgDataStore(orgId: string): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get organization store.');
  }

  // 1. Firestore
  try {
    const docSnap = await withFirestore('getOrgDataStore', async () => {
      return await adminDb.collection('offices').doc(orgId).collection('data').doc('store').get();
    }, { retries: 1, timeoutMs: 5000 });

    if (docSnap.exists) {
      return docSnap.data()?.data || docSnap.data();
    }
  } catch (err: any) {
    console.warn(`[FyRepo] Firestore read notice for org store ${orgId}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlStore = await sqlGetOrgDataStore(orgId);
      if (sqlStore) return sqlStore;
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL read notice for org store ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  // 3. Local fallback
  return localGetOrgStore(orgId);
}

export async function setOrgDataStore(orgId: string, data: any, updatedBy: string = 'system'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save organization store.');
  }

  assertUnderLimit(data, 850_000, `कार्यालय डाटा स्टोर (${orgId})`);

  const persistedTo: string[] = [];

  // 1. Primary write to Firestore with withFirestore
  await withFirestore('setOrgDataStore', async () => {
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
  });
  persistedTo.push('firestore');

  // 2. Cache in localStore (ONLY after Firestore confirms)
  try {
    localSetOrgStore(orgId, data);
    persistedTo.push('local');
  } catch (localErr: any) {
    console.warn(`[FyRepo] Local store write notice for org store ${orgId}:`, localErr?.message || localErr);
  }

  // 3. Mirror to Cloud SQL if operational
  if (await isSqlEnabled()) {
    try {
      await sqlSetOrgDataStore(orgId, data, updatedBy);
      persistedTo.push('sql');
    } catch (sqlErr: any) {
      console.warn(`[FyRepo] SQL store mirror notice for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  const result = { success: true, orgId };
  return Object.assign({ entity: result, persistedTo }, result);
}

export async function getEmployees(orgId: string, fiscalYear?: string): Promise<any[]> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to get employees.');
  }

  if (fiscalYear) {
    const fySlug = slugifyFiscalYear(fiscalYear);
    try {
      const snap = await adminDb
        .collection('offices')
        .doc(orgId)
        .collection('fiscal_years')
        .doc(fySlug)
        .collection('employees')
        .get();

      if (!snap.empty) {
        return snap.docs.map((d) => d.data());
      }
    } catch (err) {
      console.warn(`[FyRepo] Firestore getEmployees error:`, err);
    }
  }

  if (await isSqlEnabled()) {
    try {
      const emps = await sqlGetEmployees(orgId);
      if (emps && emps.length > 0) return emps;
    } catch (err: any) {
      console.warn(`[FyRepo] SQL getEmployees error:`, err);
    }
  }
  return localGetEmployees(orgId, fiscalYear);
}

export async function upsertEmployee(employee: any, orgId: string, fiscalYear: string = '२०८१/८२'): Promise<any> {
  if (!orgId) {
    throw new Error('Tenant scoping violation: orgId is required to save employee.');
  }

  const empId = String(employee.id || employee.employeeId || `emp_${Date.now()}`);
  const fySlug = slugifyFiscalYear(fiscalYear);

  await withFirestore('upsertEmployee', async () => {
    const empRef = adminDb
      .collection('offices')
      .doc(orgId)
      .collection('fiscal_years')
      .doc(fySlug)
      .collection('employees')
      .doc(empId);

    await empRef.set({
      ...employee,
      id: empId,
      officeId: orgId,
      fiscalYear,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });

  localSaveEmployee(orgId, fiscalYear, employee);

  if (await isSqlEnabled()) {
    try {
      await sqlUpsertEmployee(employee, orgId);
    } catch (err: any) {
      console.warn(`[FyRepo] SQL upsertEmployee notice for org ${orgId}:`, err?.message || err);
    }
  }

  return employee;
}

export async function deleteOrgFiscalYear(orgId: string, fiscalYear: string): Promise<boolean> {
  if (!orgId || !fiscalYear) return false;

  const fySlug = slugifyFiscalYear(fiscalYear);

  await withFirestore('deleteOrgFiscalYear', async () => {
    const fyRef = adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fySlug);
    
    // Delete employees in subcollection
    const empSnaps = await fyRef.collection('employees').get();
    if (!empSnaps.empty) {
      const batch = adminDb.batch();
      empSnaps.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete FY doc
    await fyRef.delete();
    await adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fiscalYear).delete().catch(() => {});

    // Update legacy fy_database doc if present
    const docRef = adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database');
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data()?.data || snap.data() || {};
      delete d[fiscalYear];
      await docRef.set({ data: d, updatedAt: new Date().toISOString() }, { merge: true });
    }
  });

  localDeleteFiscalYear(orgId, fiscalYear);
  return true;
}

export async function clearOrgFiscalYearData(orgId: string, fiscalYear: string): Promise<boolean> {
  if (!orgId || !fiscalYear) return false;

  const fySlug = slugifyFiscalYear(fiscalYear);

  await withFirestore('clearOrgFiscalYearData', async () => {
    const fyRef = adminDb.collection('offices').doc(orgId).collection('fiscal_years').doc(fySlug);
    
    // Delete employees in subcollection
    const empSnaps = await fyRef.collection('employees').get();
    if (!empSnaps.empty) {
      const batch = adminDb.batch();
      empSnaps.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    const emptyPayload = {
      officeId: orgId,
      fiscalYear,
      salarySetups: {},
      deductionSetups: {},
      taxReferences: [],
      updatedAt: new Date().toISOString(),
    };
    await fyRef.set(emptyPayload);

    // Legacy mirror update
    const docRef = adminDb.collection('offices').doc(orgId).collection('data').doc('fy_database');
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data()?.data || snap.data() || {};
      d[fiscalYear] = { ...emptyPayload, employees: [] };
      await docRef.set({ data: d, updatedAt: new Date().toISOString() }, { merge: true });
    }
  });

  localClearFiscalYear(orgId, fiscalYear);
  return true;
}
