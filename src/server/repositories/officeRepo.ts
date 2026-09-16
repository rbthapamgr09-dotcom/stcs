import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import { withFirestore, PersistenceError } from './firestoreGuard.ts';
import { assertUnderLimit } from '../utils/chunking.ts';
import { optimizeAssetUrl } from '../utils/assetStorage.ts';
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

export type OfficeSaveResult = {
  entity: OfficeEntity;
  persistedTo: string[];
} & OfficeEntity;

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

export async function saveOffice(data: any): Promise<OfficeSaveResult> {
  const office = cleanData(data);

  // Optimize large base64 logo/signature to avoid exceeding Firestore limits
  if (office.logoUrl && office.logoUrl.startsWith('data:image/')) {
    office.logoUrl = await optimizeAssetUrl(office.id, 'logo', office.logoUrl);
  }
  if (office.signatureUrl && office.signatureUrl.startsWith('data:image/')) {
    office.signatureUrl = await optimizeAssetUrl(office.id, 'signature', office.signatureUrl);
  }

  // Guard document size limit
  assertUnderLimit(office, 850_000, `कार्यालय (${office.officeName})`);

  const persistedTo: string[] = [];

  // 1. Primary write to Firestore with retry and timeout guard
  await withFirestore('saveOffice', async () => {
    const docRef = adminDb.collection('offices').doc(office.id);
    await docRef.set(office, { merge: true });
  });
  persistedTo.push('firestore');

  // 2. Local cache persistence (ONLY after Firestore confirms)
  try {
    localSaveOffice(office);
    persistedTo.push('local');
  } catch (localErr: any) {
    console.warn(`[OfficeRepo] Local cache write notice for office ${office.id}:`, localErr?.message || localErr);
  }

  // 3. Mirror to Cloud SQL if operational
  try {
    if (await isSqlEnabled()) {
      await upsertSqlOrganization(office);
      persistedTo.push('sql');
    }
  } catch (sqlErr: any) {
    console.warn(`[OfficeRepo] SQL mirror notice for office ${office.id}:`, sqlErr?.message || sqlErr);
  }

  return Object.assign({ entity: office, persistedTo }, office);
}

export async function getOfficeById(id: string): Promise<OfficeEntity | null> {
  if (!id) return null;

  // 1. Read from Firestore
  try {
    const docSnap = await withFirestore('getOfficeById', async () => {
      return await adminDb.collection('offices').doc(id).get();
    }, { retries: 1, timeoutMs: 5000 });

    if (docSnap.exists) {
      return docSnap.data() as OfficeEntity;
    }
  } catch (err: any) {
    console.warn(`[OfficeRepo] Firestore read error for office ${id}:`, err?.message || err);
  }

  // 2. Fallback to SQL
  if (await isSqlEnabled()) {
    try {
      const sqlOrg = await getSqlOrganizationById(id);
      if (sqlOrg) return cleanData(sqlOrg);
    } catch (sqlErr: any) {
      console.warn(`[OfficeRepo] SQL read error for office ${id}:`, sqlErr?.message || sqlErr);
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
    const snap = await withFirestore('listOffices', async () => {
      return await adminDb.collection('offices').get();
    }, { retries: 1, timeoutMs: 6000 });

    snap.forEach((doc) => {
      officesMap.set(doc.id, doc.data() as OfficeEntity);
    });
  } catch (err: any) {
    console.warn('[OfficeRepo] Firestore listOffices error:', err?.message || err);
  }

  // 2. Read from SQL if Firestore returned nothing
  if (officesMap.size === 0 && (await isSqlEnabled())) {
    try {
      const sqlOrgs = await getSqlOrganizations();
      for (const org of sqlOrgs) {
        officesMap.set(org.id, cleanData(org));
      }
    } catch (sqlErr: any) {
      console.warn('[OfficeRepo] SQL listOffices error:', sqlErr?.message || sqlErr);
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

  // 1. Primary delete from Firestore
  await withFirestore('deleteOffice', async () => {
    const officeDoc = adminDb.collection('offices').doc(id);

    // Delete fiscal_years subcollection
    const fySnaps = await officeDoc.collection('fiscal_years').get();
    if (!fySnaps.empty) {
      const batch = adminDb.batch();
      fySnaps.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete data subcollection
    const dataSnaps = await officeDoc.collection('data').get();
    if (!dataSnaps.empty) {
      const batch = adminDb.batch();
      dataSnaps.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete main document
    await officeDoc.delete();

    // Clean legacy registered_offices mirror doc if present
    const legacyRef = adminDb.collection('system_organizations').doc('registered_offices');
    const snap = await legacyRef.get();
    if (snap.exists && Array.isArray(snap.data()?.organizations)) {
      const filtered = snap.data()?.organizations.filter((o: any) => o.id !== id);
      await legacyRef.set({ organizations: filtered, updatedAt: new Date().toISOString() });
    }
  });

  // 2. Delete from local store cache
  localDeleteOffice(id);

  // 3. Delete from SQL if enabled
  if (await isSqlEnabled()) {
    try {
      await deleteSqlOrganizationById(id);
    } catch (sqlErr: any) {
      console.warn(`[OfficeRepo] SQL delete notice for office ${id}:`, sqlErr?.message || sqlErr);
    }
  }

  return true;
}

export async function clearAllOffices(): Promise<boolean> {
  // 1. Primary clear in Firestore
  await withFirestore('clearAllOffices', async () => {
    const snaps = await adminDb.collection('offices').get();
    if (!snaps.empty) {
      const batch = adminDb.batch();
      snaps.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    const legacyRef = adminDb.collection('system_organizations').doc('registered_offices');
    await legacyRef.delete().catch(() => {});
  });

  // 2. Clear local cache
  const localList = localListOffices();
  for (const o of localList) {
    if (o.id) localDeleteOffice(o.id);
  }

  return true;
}
