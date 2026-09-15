import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import {
  localSaveOffice,
  localGetOffice,
  localListOffices,
  localDeleteOffice,
} from './localStore.ts';
import {
  getOrganizations as getSqlOrganizations,
  getOrganizationById as getSqlOrganizationById,
  upsertOrganization as upsertSqlOrganization,
  deleteOrganizationById as deleteSqlOrganizationById,
} from '../../db/payroll.ts';

export interface OfficeEntity {
  id: string;
  name: string;
  officeName: string;
  officeCode?: string;
  ministryName?: string;
  departmentName?: string;
  parentBodyName?: string;
  province: string;
  district: string;
  localLevel?: string;
  address: string;
  email: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string;
  website?: string;
  panNumber?: string;
  registrationNo?: string;
  authorizedPersonName?: string;
  authorizedPersonDesignation?: string;
  currentFiscalYear?: string;
  logoUrl?: string;
  signatureUrl?: string;
  headerText?: string;
  footerText?: string;
  alignment?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  driveFolderId?: string;
  lastSyncedAt?: string;
  syncStatus?: string;
  createdById?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function cleanData(data: any): OfficeEntity {
  if (!data || typeof data !== 'object') {
    data = {};
  }
  const orgId = data.id || `org_${Date.now()}`;
  return {
    id: String(orgId),
    name: data.name || 'नेपाल सरकार',
    officeName: data.officeName || data.name || 'कार्यालय',
    officeCode: data.officeCode || '',
    ministryName: data.ministryName || '',
    departmentName: data.departmentName || '',
    parentBodyName: data.parentBodyName || '',
    province: data.province || 'बागमती प्रदेश',
    district: data.district || 'काठमाडौं',
    localLevel: data.localLevel || '',
    address: data.address || '',
    email: data.email || '',
    phone: data.phone || '',
    mobile: data.mobile || '',
    whatsapp: data.whatsapp || '',
    website: data.website || '',
    panNumber: data.panNumber || data.pan || '',
    registrationNo: data.registrationNo || '',
    authorizedPersonName: data.authorizedPersonName || '',
    authorizedPersonDesignation: data.authorizedPersonDesignation || '',
    currentFiscalYear: data.currentFiscalYear || '२०८१/८२',
    logoUrl: data.logoUrl || '',
    signatureUrl: data.signatureUrl || '',
    headerText: data.headerText || '',
    footerText: data.footerText || '',
    alignment: data.alignment || 'center',
    spreadsheetId: data.spreadsheetId || '',
    spreadsheetUrl: data.spreadsheetUrl || '',
    driveFolderId: data.driveFolderId || '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj',
    lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
    syncStatus: data.syncStatus || 'IDLE',
    createdById: data.createdById || '',
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveOffice(data: any): Promise<OfficeEntity> {
  const office = cleanData(data);

  // 1. Always guarantee persistence in local file-backed store
  try {
    localSaveOffice(office);
  } catch (localErr: any) {
    console.warn(`[OfficeRepo] Local store write notice for office ${office.id}:`, localErr?.message || localErr);
  }

  // 2. Best-effort Firestore write via adminDb
  try {
    const docRef = adminDb.collection('offices').doc(office.id);
    await docRef.set(office, { merge: true });
  } catch (err: any) {
    // Firestore admin warning handled gracefully
  }

  // 3. Best-effort mirror to Cloud SQL
  try {
    if (await isSqlEnabled()) {
      await upsertSqlOrganization(office);
    }
  } catch (sqlErr: any) {
    console.warn(`[OfficeRepo] SQL mirror notice for office ${office.id}:`, sqlErr?.message || sqlErr);
  }

  return office;
}

export async function getOfficeById(id: string): Promise<OfficeEntity | null> {
  if (!id) return null;

  // 1. Read from Firestore
  try {
    const docSnap = await adminDb.collection('offices').doc(id).get();
    if (docSnap.exists) {
      return docSnap.data() as OfficeEntity;
    }
  } catch (err: any) {
    // Fallback to local / SQL
  }

  // 2. Fallback to SQL
  if (await isSqlEnabled()) {
    try {
      const sqlOrg = await getSqlOrganizationById(id);
      if (sqlOrg) return cleanData(sqlOrg);
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. Fallback to localStore
  const local = localGetOffice(id);
  if (local) return cleanData(local);

  return null;
}

export async function listOffices(): Promise<OfficeEntity[]> {
  const officesMap = new Map<string, OfficeEntity>();

  // 1. Read from Firestore
  try {
    const snap = await adminDb.collection('offices').get();
    snap.forEach((doc) => {
      officesMap.set(doc.id, doc.data() as OfficeEntity);
    });
  } catch (err: any) {
    // Fallback
  }

  // 2. Read from SQL if Firestore returned nothing
  if (officesMap.size === 0 && (await isSqlEnabled())) {
    try {
      const sqlOrgs = await getSqlOrganizations();
      for (const org of sqlOrgs) {
        officesMap.set(org.id, cleanData(org));
      }
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. Merge or fallback with localStore
  const localList = localListOffices();
  for (const o of localList) {
    if (!officesMap.has(o.id)) {
      officesMap.set(o.id, cleanData(o));
    }
  }

  return Array.from(officesMap.values());
}

export async function deleteOfficeById(id: string): Promise<boolean> {
  if (!id) return false;

  localDeleteOffice(id);

  // Firestore: delete office document and subcollections
  try {
    const officeDoc = adminDb.collection('offices').doc(id);
    
    // Delete subcollections
    try {
      const fySnaps = await officeDoc.collection('fiscal_years').get();
      const batch = adminDb.batch();
      fySnaps.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch {}

    try {
      const dataSnaps = await officeDoc.collection('data').get();
      const batch = adminDb.batch();
      dataSnaps.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch {}

    await officeDoc.delete();

    // Legacy mirror update
    try {
      const legacyRef = adminDb.collection('system_organizations').doc('registered_offices');
      const snap = await legacyRef.get();
      if (snap.exists && Array.isArray(snap.data()?.organizations)) {
        const filtered = snap.data()?.organizations.filter((o: any) => o.id !== id);
        await legacyRef.set({ organizations: filtered, updatedAt: new Date().toISOString() });
      }
    } catch {}
  } catch (err: any) {
    console.warn(`[OfficeRepo] Notice deleting office ${id} from Firestore:`, err?.message || err);
  }

  if (await isSqlEnabled()) {
    try {
      await deleteSqlOrganizationById(id);
    } catch (sqlErr: any) {
      // Handled
    }
  }

  return true;
}

export async function clearAllOffices(): Promise<boolean> {
  // 1. Local
  const localList = localListOffices();
  for (const o of localList) {
    if (o.id) localDeleteOffice(o.id);
  }

  // 2. Firestore
  try {
    const snaps = await adminDb.collection('offices').get();
    const batch = adminDb.batch();
    snaps.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    try {
      await adminDb.collection('system_organizations').doc('registered_offices').delete();
    } catch {}
  } catch (err: any) {
    console.warn('[OfficeRepo] Error clearing all offices from Firestore:', err);
  }

  return true;
}
