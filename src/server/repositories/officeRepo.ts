import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
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
  const orgId = data.id || `org_${Date.now()}`;
  return {
    id: orgId,
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
  let firestoreSaved = false;

  // 1. Write to Firestore via adminDb first
  try {
    const docRef = adminDb.collection('offices').doc(office.id);
    await docRef.set(office, { merge: true });
    firestoreSaved = true;
  } catch (err: any) {
    console.warn(`[OfficeRepo] Firestore write error for office ${office.id}:`, err?.message || err);
  }

  // 2. Best-effort mirror to Cloud SQL
  if (await isSqlEnabled()) {
    try {
      await upsertSqlOrganization(office);
    } catch (sqlErr: any) {
      console.warn(`[OfficeRepo] SQL mirror error for office ${office.id}:`, sqlErr?.message || sqlErr);
      if (!firestoreSaved) {
        throw new Error(`Failed to save office to both Firestore and SQL: ${sqlErr.message}`);
      }
    }
  } else if (!firestoreSaved) {
    throw new Error('Could not persist office: Firestore is unavailable and SQL is disabled.');
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
    console.warn(`[OfficeRepo] Firestore read error for office ${id}:`, err?.message || err);
  }

  // 2. Fallback to SQL
  if (await isSqlEnabled()) {
    try {
      const sqlOrg = await getSqlOrganizationById(id);
      if (sqlOrg) return cleanData(sqlOrg);
    } catch (sqlErr: any) {
      console.warn(`[OfficeRepo] SQL fallback read error for office ${id}:`, sqlErr?.message || sqlErr);
    }
  }

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
    console.warn('[OfficeRepo] Firestore list error:', err?.message || err);
  }

  // 2. Read from SQL if Firestore returned nothing or on error
  if (officesMap.size === 0 && (await isSqlEnabled())) {
    try {
      const sqlOrgs = await getSqlOrganizations();
      for (const org of sqlOrgs) {
        officesMap.set(org.id, cleanData(org));
      }
    } catch (sqlErr: any) {
      console.warn('[OfficeRepo] SQL list error:', sqlErr?.message || sqlErr);
    }
  }

  return Array.from(officesMap.values());
}

export async function deleteOfficeById(id: string): Promise<boolean> {
  if (!id) return false;

  try {
    await adminDb.collection('offices').doc(id).delete();
  } catch (err: any) {
    console.warn(`[OfficeRepo] Firestore delete error for office ${id}:`, err?.message || err);
  }

  if (await isSqlEnabled()) {
    try {
      await deleteSqlOrganizationById(id);
    } catch (sqlErr: any) {
      console.warn(`[OfficeRepo] SQL delete error for office ${id}:`, sqlErr?.message || sqlErr);
    }
  }

  return true;
}
