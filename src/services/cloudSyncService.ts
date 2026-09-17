import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleSheetsConfig, OrganizationSetup, OrganizationItem, User, SystemSupportContact } from '../types';
import { verifyPasswordSync } from '../utils/securityUtils';

import { saveOfficeToFirestore, saveUserToFirestore, getUserFromFirestore } from './firestoreService';
import { deduplicateOrganizations, deduplicateUsers } from '../utils/deduplicate';
import { auth } from '../lib/firebase';

export class ClientApiError extends Error {
  state: 'OFFLINE' | 'TIMEOUT' | 'SERVER' | 'VALIDATION' | 'UNKNOWN';
  code: string;

  constructor(opts: { state: 'OFFLINE' | 'TIMEOUT' | 'SERVER' | 'VALIDATION' | 'UNKNOWN'; code: string; message: string }) {
    super(opts.message);
    this.name = 'ClientApiError';
    this.state = opts.state;
    this.code = opts.code;
  }
}

/**
 * Extracts human-readable, user-friendly error messages from API responses.
 * Never returns empty string or unparsed raw object strings.
 */
export async function parseApiError(res: Response): Promise<{ code: string; message: string }> {
  try {
    const clone = res.clone();
    try {
      const data = await clone.json();
      if (data) {
        const code = data.code || `HTTP_${res.status}`;
        const message = data.message || data.error;
        if (message && typeof message === 'string' && message.trim().length > 0) {
          return { code, message: message.trim() };
        }
      }
    } catch {
      const text = await res.clone().text();
      if (text && text.trim().length > 0 && text.length < 300 && !text.startsWith('<')) {
        return { code: `HTTP_${res.status}`, message: text.trim() };
      }
    }
  } catch {}

  let code = `HTTP_${res.status}`;
  let message = '';
  switch (res.status) {
    case 503:
      code = 'SERVICE_UNAVAILABLE';
      message = 'सर्भरको डाटाबेस हाल उपलब्ध छैन — कृपया केही समयपछि पुनः प्रयास गर्नुहोस्।';
      break;
    case 502:
    case 504:
      code = 'GATEWAY_ERROR';
      message = 'सर्भरसँग सम्पर्क हुन सकेन (गेटवे त्रुटि)।';
      break;
    case 500:
      code = 'INTERNAL_SERVER_ERROR';
      message = 'सर्भरमा आन्तरिक समस्या आयो — विवरण सुरक्षित भएन।';
      break;
    case 413:
      code = 'PAYLOAD_TOO_LARGE';
      message = 'पठाइएको विवरण सर्भरको सीमाभन्दा ठूलो छ।';
      break;
    case 401:
      code = 'UNAUTHORIZED';
      message = 'प्रयोगकर्ता प्रमाणीकरण आवश्यक छ। कृपया पुनः लगइन गर्नुहोस्।';
      break;
    case 403:
      code = 'FORBIDDEN';
      message = 'यो कार्यालयको विवरण परिवर्तन गर्ने अनुमति छैन।';
      break;
    case 422:
      code = 'VALIDATION_ERROR';
      message = 'प्रदान गरिएको विवरण मान्य छैन। कृपया आवश्यक विवरण रुजु गर्नुहोस्।';
      break;
    case 400:
      code = 'BAD_REQUEST';
      message = 'पठाइएको विवरण अमान्य छ।';
      break;
    case 404:
      code = 'NOT_FOUND';
      message = 'खोजिएको कार्यालय वा विवरण फेला परेन।';
      break;
    default:
      message = `सर्भरबाट त्रुटि प्राप्त भयो (Status: ${res.status})।`;
  }
  return { code, message };
}

/**
 * Helper to perform authenticated HTTP requests to backend API,
 * automatically passing the Firebase ID token in Authorization header when available.
 * Implements 10-second timeout, offline detection, and 2-attempt retry with backoff.
 */
export async function authenticatedFetch(
  url: string,
  init?: RequestInit,
  opts?: { retries?: number; timeoutMs?: number }
): Promise<Response> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ClientApiError({
      state: 'OFFLINE',
      code: 'OFFLINE',
      message: 'इन्टरनेट सम्पर्क विच्छेद भएको छ (Offline)। कृपया इन्टरनेट जाँच गर्नुहोस्।',
    });
  }

  const maxRetries = opts?.retries ?? (init?.method && init.method !== 'GET' ? 2 : 1);
  const timeoutMs = opts?.timeoutMs ?? 10000;
  const backoffs = [800, 2400];

  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let token: string | null = null;
      try {
        if (auth?.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch (err) {
        // Non-fatal token retrieval notice
      }
      if (!token && typeof localStorage !== 'undefined') {
        try {
          token = localStorage.getItem('AUTH_TOKEN') || localStorage.getItem('np_session_token') || localStorage.getItem('session_token');
        } catch {}
      }
      if (!token && typeof sessionStorage !== 'undefined') {
        try {
          token = sessionStorage.getItem('AUTH_TOKEN');
        } catch {}
      }

      const headers = new Headers(init?.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const signal = init?.signal ? init.signal : controller.signal;

      const res = await fetch(url, {
        ...init,
        headers,
        signal,
      });

      clearTimeout(timeoutId);

      // Retry on 502, 503, 504
      if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
        lastResponse = res;
        await new Promise((r) => setTimeout(r, backoffs[attempt] || 2400));
        continue;
      }

      return res;
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      lastError = fetchErr;

      if (fetchErr?.name === 'AbortError') {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, backoffs[attempt] || 2400));
          continue;
        }
        throw new ClientApiError({
          state: 'TIMEOUT',
          code: 'TIMEOUT',
          message: 'सर्भरबाट प्रतिक्रिया आउन १० सेकेन्डभन्दा बढी समय लाग्यो (Timeout)।',
        });
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffs[attempt] || 2400));
        continue;
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw new ClientApiError({
    state: 'SERVER',
    code: 'NETWORK_ERROR',
    message: lastError?.message || 'सर्भरसँग सम्पर्क हुन सकेन।',
  });
}

export interface CloudSaveResult {
  ok: boolean;
  code?: string;
  error?: string;
  state?: 'OFFLINE' | 'TIMEOUT' | 'SERVER' | 'VALIDATION' | 'UNKNOWN';
}

/**
 * Persists active fiscal year and fiscal year list across Cloud SQL and Firestore
 */
export async function saveCloudFiscalYearConfig(data: {
  activeFiscalYear: string;
  fiscalYears: string[];
}): Promise<CloudSaveResult> {
  try {
    const res = await authenticatedFetch('/api/system-settings/active_fiscal_year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          activeFiscalYear: data.activeFiscalYear,
          fiscalYears: data.fiscalYears,
        },
      }),
    });
    if (!res.ok) {
      const parsed = await parseApiError(res);
      const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
      return { ok: false, code: parsed.code, error: parsed.message, state };
    }
    return { ok: true };
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'नेटवर्क त्रुटि आयो।', state: 'SERVER' };
  }
}

/**
 * Persists full Fiscal Year isolated database to backend for a specific Organization
 */
export async function saveCloudFyDatabase(
  fyDb: Record<string, any>,
  orgId: string = 'org_default'
): Promise<CloudSaveResult> {
  const targetOrg = orgId || 'org_default';
  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(targetOrg)}/fy-database`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: fyDb }),
    });
    if (!res.ok) {
      const parsed = await parseApiError(res);
      const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
      return { ok: false, code: parsed.code, error: parsed.message, state };
    }
    return { ok: true };
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'नेटवर्क त्रुटि आयो।', state: 'SERVER' };
  }
}

/**
 * Retrieves the full Fiscal Year isolated database from Cloud SQL & Firestore for a specific Organization
 */
export async function getCloudFyDatabase(orgId: string = 'org_default'): Promise<Record<string, any> | null> {
  const targetOrg = orgId || 'org_default';
  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(targetOrg)}/fy-database`);
    if (res.ok) {
      const json = await res.json();
      const d = json.data?.data || json.data;
      if (d && typeof d === 'object' && Object.keys(d).length > 0) {
        return d;
      }
    }
  } catch (err) {}
  return null;
}

/**
 * Persists the entire organization data store (org, FYs, active FY, fyDatabase, users, sheetsConfig)
 */
export async function saveCloudOrgStore(orgId: string, store: any): Promise<CloudSaveResult> {
  if (!orgId) return { ok: false, error: 'orgId is required' };
  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(orgId)}/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: store }),
    });
    if (!res.ok) {
      const parsed = await parseApiError(res);
      const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
      return { ok: false, code: parsed.code, error: parsed.message, state };
    }
    return { ok: true };
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'Network error saving store', state: 'SERVER' };
  }
}

export const saveCloudDataStore = saveCloudOrgStore;


/**
 * Retrieves the entire organization data store from Cloud SQL & Firestore
 */
export async function getCloudOrgStore(orgId: string): Promise<any | null> {
  if (!orgId) return null;
  try {
    const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/store`);
    if (res.ok) {
      const json = await res.json();
      if (json.store) return json.store;
    }
  } catch (err) {}

  try {
    const storeRef = doc(db, CONNECTIONS_COLLECTION, `org_store_${orgId}`);
    const snap = await getDoc(storeRef);
    if (snap.exists()) {
      const d = snap.data();
      if (d?.store) return d.store;
    }
  } catch (err) {}

  return null;
}

/**
 * Persists user profile data scoped to a specific organization
 */
export async function saveCloudOrgUser(orgId: string, user: any): Promise<boolean> {
  try {
    await fetch(`/api/organizations/${encodeURIComponent(orgId)}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
  } catch (err) {
    console.warn(`Failed to save user for ${orgId} to Cloud SQL:`, err);
  }

  if (canWriteFirestore()) {
    try {
      const targetUid = user.uid || user.id || user.username;
      const userRef = doc(db, 'users', targetUid);
      await setDoc(userRef, { ...user, organizationId: orgId, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      handleFirestoreWriteError(err, 'saveCloudOrgUser');
    }
  }
  return true;
}

/**
 * Persists organization and fiscal year scoped tax references to Cloud SQL and Firestore
 */
export async function saveCloudTaxReferences(
  taxRefs: any[],
  orgId: string = 'org_default',
  fiscalYear: string
): Promise<boolean> {
  const targetOrg = orgId || 'org_default';
  const cleanFy = fiscalYear.replace(/\//g, '_');
  try {
    await fetch(`/api/organizations/${encodeURIComponent(targetOrg)}/tax-references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fiscalYear, taxReferences: taxRefs }),
    });
  } catch (sqlErr) {
    console.warn(`Could not save tax references for ${targetOrg} to Cloud SQL:`, sqlErr);
  }

  if (canWriteFirestore()) {
    try {
      const taxDocRef = doc(db, 'offices', targetOrg, 'tax_references', cleanFy);
      await setDoc(
        taxDocRef,
        {
          taxReferences: taxRefs,
          fiscalYear,
          orgId: targetOrg,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const connDocRef = doc(db, CONNECTIONS_COLLECTION, `tax_refs_${targetOrg}_${cleanFy}`);
      await setDoc(
        connDocRef,
        {
          taxReferences: taxRefs,
          fiscalYear,
          orgId: targetOrg,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return true;
    } catch (err) {
      handleFirestoreWriteError(err, `saveCloudTaxReferences_${targetOrg}`);
    }
  }
  return true;
}

/**
 * Retrieves organization and fiscal year scoped tax references from Cloud SQL and Firestore
 */
export async function getCloudTaxReferences(
  orgId: string = 'org_default',
  fiscalYear: string
): Promise<any[] | null> {
  const targetOrg = orgId || 'org_default';
  const cleanFy = fiscalYear.replace(/\//g, '_');
  try {
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(targetOrg)}/tax-references?fiscalYear=${encodeURIComponent(fiscalYear)}`
    );
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.taxReferences) && json.taxReferences.length > 0) {
        return json.taxReferences;
      }
    }
  } catch (err) {}

  try {
    const taxDocRef = doc(db, 'offices', targetOrg, 'tax_references', cleanFy);
    const snap = await getDoc(taxDocRef);
    if (snap.exists()) {
      const d = snap.data();
      if (Array.isArray(d?.taxReferences) && d.taxReferences.length > 0) {
        return d.taxReferences;
      }
    }
  } catch (err) {}

  try {
    const connDocRef = doc(db, CONNECTIONS_COLLECTION, `tax_refs_${targetOrg}_${cleanFy}`);
    const snap = await getDoc(connDocRef);
    if (snap.exists()) {
      const d = snap.data();
      if (Array.isArray(d?.taxReferences) && d.taxReferences.length > 0) {
        return d.taxReferences;
      }
    }
  } catch (err) {}

  return null;
}

/**
 * Retrieves user profiles belonging to a specific organization
 */
export async function getCloudOrgUsers(orgId: string): Promise<any[] | null> {
  try {
    const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/users`);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.users)) return json.users;
    }
  } catch (err) {}
  return null;
}

/**
 * Retrieves the persisted fiscal year config from Cloud SQL or Firestore
 */
export async function getCloudFiscalYearConfig(): Promise<{
  activeFiscalYear?: string;
  fiscalYears?: string[];
} | null> {
  try {
    const res = await fetch('/api/system-settings/active_fiscal_year');
    if (res.ok) {
      const json = await res.json();
      const d = json.data?.data || json.data;
      if (d && d.activeFiscalYear) {
        return {
          activeFiscalYear: d.activeFiscalYear,
          fiscalYears: d.fiscalYears,
        };
      }
    }
  } catch (err) {}

  try {
    const mainDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    const mainSnap = await getDoc(mainDocRef);
    if (mainSnap.exists()) {
      const d = mainSnap.data();
      if (d && (d.activeFiscalYear || d.fiscalYears)) {
        return {
          activeFiscalYear: d.activeFiscalYear,
          fiscalYears: d.fiscalYears,
        };
      }
    }
  } catch (err) {}
  return null;
}
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

// Firestore Quota Circuit Breaker & Safety Guard
let isFirestoreQuotaExhausted = false;
let quotaExhaustedTimestamp = 0;
const QUOTA_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes cooldown before attempting retry

function canWriteFirestore(): boolean {
  if (isFirestoreQuotaExhausted) {
    if (Date.now() - quotaExhaustedTimestamp > QUOTA_COOLDOWN_MS) {
      isFirestoreQuotaExhausted = false;
      return true;
    }
    return false;
  }
  return true;
}

function handleFirestoreWriteError(err: any, context: string) {
  const msg = String(err?.message || err);
  if (
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Write stream exhausted') ||
    msg.includes('quota')
  ) {
    isFirestoreQuotaExhausted = true;
    quotaExhaustedTimestamp = Date.now();
    console.warn(`Firestore quota limit reached during [${context}]. Gracefully using local/SQL cache.`);
  } else {
    console.warn(`Firestore [${context}] note:`, err);
  }
}

export interface CloudAppConnectionData {
  webAppUrl?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  connectedAccountEmail?: string;
  autoSync?: boolean;
  syncMode?: 'auto' | 'manual';
  organization?: OrganizationSetup;
  activeOrgId?: string;
  supportContact?: SystemSupportContact;
  updatedAt?: string;
  lastUpdatedBy?: string;
}

const CONNECTIONS_COLLECTION = 'system_connections';
const MAIN_CONFIG_DOC = 'active_payroll_config';
const USERS_COLLECTION = 'system_users';
const MAIN_USERS_DOC = 'registered_accounts';
const ORGANIZATIONS_COLLECTION = 'system_organizations';
const MAIN_ORGS_DOC = 'registered_offices';

/**
 * Persists a single organization to backend (Firestore + SQL mirror)
 */
export async function saveCloudOrganization(org: OrganizationItem): Promise<CloudSaveResult> {
  const payload = {
    id: org.id,
    name: org.name || 'नेपाल सरकार',
    officeName: org.officeName || '',
    officeCode: org.officeCode || org.code || '',
    ministryName: org.ministryName || '',
    departmentName: org.departmentName || '',
    parentBodyName: org.parentBodyName || '',
    province: org.province || 'बागमती प्रदेश',
    district: org.district || 'काठमाडौं',
    localLevel: org.localLevel || '',
    address: org.address || '',
    email: org.email || '',
    phone: org.phone || '',
    mobile: org.mobile || '',
    whatsapp: org.whatsapp || '',
    website: org.website || '',
    panNumber: org.panNumber || org.pan || '',
    registrationNo: org.registrationNo || '',
    authorizedPersonName: org.authorizedPersonName || '',
    authorizedPersonDesignation: org.authorizedPersonDesignation || '',
    currentFiscalYear: org.currentFiscalYear || '२०८१/८२',
    logoUrl: org.logoUrl || '',
    signatureUrl: org.signatureUrl || '',
    headerText: org.headerText || '',
    footerText: org.footerText || '',
    alignment: org.alignment || 'center',
    spreadsheetId: org.spreadsheetId || null,
    spreadsheetUrl: org.spreadsheetUrl || null,
    driveFolderId: org.driveFolderId || '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj',
    lastSyncedAt: org.lastSyncedAt || null,
    syncStatus: org.syncStatus || 'IDLE',
    createdById: org.createdById || null,
    isActive: org.isActive ?? true,
    createdAt: org.createdAt || new Date().toISOString(),
  };

  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(org.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status === 404) {
        const postRes = await authenticatedFetch('/api/offices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ office: payload }),
        });
        if (!postRes.ok) {
          const parsed = await parseApiError(postRes);
          const state = postRes.status >= 500 ? 'SERVER' : postRes.status === 400 ? 'VALIDATION' : 'UNKNOWN';
          return { ok: false, code: parsed.code, error: parsed.message, state };
        }
      } else {
        const parsed = await parseApiError(res);
        const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
        return { ok: false, code: parsed.code, error: parsed.message, state };
      }
    }
    return { ok: true };
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'Network error saving organization', state: 'SERVER' };
  }
}

/**
 * Persists organizations list to backend
 */
export async function saveCloudOrganizations(orgs: OrganizationItem[]): Promise<CloudSaveResult> {
  const cleanOrgs = deduplicateOrganizations(orgs);
  let failed = 0;
  let lastError = '';

  for (const org of cleanOrgs) {
    const res = await saveCloudOrganization(org);
    if (!res.ok) {
      failed++;
      lastError = res.error || '';
    }
  }

  if (failed > 0) {
    return { ok: false, error: `${failed} organizations failed to sync. Last error: ${lastError}` };
  }
  return { ok: true };
}

/**
 * Retrieves all registered organizations from backend (Firestore + SQL)
 */
export async function getCloudOrganizations(): Promise<OrganizationItem[] | null> {
  try {
    const res = await authenticatedFetch('/api/offices');
    if (res.ok) {
      const json = await res.json();
      const rawList = json.offices || json.organizations;
      if (Array.isArray(rawList) && rawList.length > 0) {
        return deduplicateOrganizations(rawList);
      }
    }
  } catch (err) {
    console.warn('Could not fetch organizations from backend:', err);
  }
  return null;
}


/**
 * Removes an organization from Cloud SQL and Cloud Firestore
 */
export async function deleteCloudOrganization(orgId: string): Promise<CloudSaveResult> {
  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(orgId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const parsed = await parseApiError(res);
      const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
      return { ok: false, code: parsed.code, error: parsed.message, state };
    }
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'नेटवर्क त्रुटि आयो।', state: 'SERVER' };
  }

  if (canWriteFirestore()) {
    try {
      const { deleteOfficeFromFirestore } = await import('./firestoreService');
      await deleteOfficeFromFirestore(orgId);
    } catch (fsErr) {
      handleFirestoreWriteError(fsErr, 'deleteCloudOrganization');
    }
  }
  return { ok: true };
}

/**
 * Persists organization-specific Google Sheets configuration
 */
export async function saveOrgSheetsConfig(orgId: string, config: GoogleSheetsConfig): Promise<boolean> {
  const key = `sheets_config_${orgId}`;
  try {
    await fetch(`/api/settings/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: config }),
    });
  } catch (err) {
    console.warn('Could not save org sheets config to Cloud SQL:', err);
  }

  if (canWriteFirestore()) {
    try {
      const docRef = doc(db, CONNECTIONS_COLLECTION, key);
      await setDoc(docRef, { ...config, updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreWriteError(err, 'saveOrgSheetsConfig');
      return true;
    }
  }
  return true;
}

/**
 * Retrieves organization-specific Google Sheets configuration
 */
export async function getOrgSheetsConfig(orgId: string): Promise<GoogleSheetsConfig | null> {
  const key = `sheets_config_${orgId}`;
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data && (json.data.webAppUrl || json.data.spreadsheetId)) {
        return json.data as GoogleSheetsConfig;
      }
    }
  } catch (err) {
    console.warn('Could not get org sheets config from Cloud SQL:', err);
  }

  try {
    const docRef = doc(db, CONNECTIONS_COLLECTION, key);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as GoogleSheetsConfig;
    }
  } catch (err) {
    console.warn('Could not get org sheets config from Firestore:', err);
  }
  return null;
}

/**
 * Persists active Google Sheets connection and organization profile to Cloud SQL and Cloud Firestore
 */
export async function saveCloudAppConnection(
  config: GoogleSheetsConfig,
  organization?: OrganizationSetup,
  activeOrgId?: string,
  updatedBy?: string,
  supportContact?: SystemSupportContact
): Promise<boolean> {
  const data: CloudAppConnectionData = {
    webAppUrl: (config.webAppUrl || '').trim(),
    spreadsheetId: (config.spreadsheetId || '').trim(),
    spreadsheetUrl: (config.spreadsheetUrl || '').trim(),
    spreadsheetName: (config.spreadsheetName || '').trim(),
    connectedAccountEmail: (config.connectedAccountEmail || '').trim(),
    autoSync: config.autoSync ?? true,
    syncMode: config.syncMode || 'auto',
    organization: organization || undefined,
    activeOrgId: activeOrgId || 'org_default',
    supportContact: supportContact || undefined,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy || 'system',
  };

  // 1. Sync to Cloud SQL via backend API
  try {
    await fetch('/api/settings/active_payroll_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, updatedBy }),
    });

    if (organization) {
      await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...organization, id: activeOrgId || 'org_default' }),
      });
    }
  } catch (sqlErr) {
    console.warn('Could not save connection to Cloud SQL API:', sqlErr);
  }

  // 2. Sync to Firestore for multi-device fallback
  if (canWriteFirestore()) {
    try {
      const configDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
      await setDoc(configDocRef, data, { merge: true });

      if (updatedBy) {
        const userDocRef = doc(db, CONNECTIONS_COLLECTION, `user_${updatedBy.toLowerCase()}`);
        await setDoc(userDocRef, data, { merge: true });
      }
      return true;
    } catch (err) {
      handleFirestoreWriteError(err, 'saveCloudAppConnection');
      return true; // Cloud SQL may have already succeeded
    }
  }
  return true;
}

/**
 * Retrieves the persisted Google Sheets connection from Cloud SQL or Firestore.
 */
export async function getCloudAppConnection(
  userIdOrUsername?: string
): Promise<CloudAppConnectionData | null> {
  // 1. Try fetching from Cloud SQL backend API
  try {
    const res = await fetch('/api/settings/active_payroll_config');
    if (res.ok) {
      const json = await res.json();
      if (json.data && (json.data.webAppUrl || json.data.spreadsheetId || json.data.organization)) {
        return json.data as CloudAppConnectionData;
      }
    }
  } catch (sqlErr) {
    console.warn('Could not fetch connection from Cloud SQL API:', sqlErr);
  }

  // 2. Try Firestore fallback
  try {
    if (userIdOrUsername) {
      const userDocRef = doc(db, CONNECTIONS_COLLECTION, `user_${userIdOrUsername.toLowerCase()}`);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const d = userSnap.data() as CloudAppConnectionData;
        if (d.webAppUrl || d.spreadsheetId) {
          return d;
        }
      }
    }

    const mainDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    const mainSnap = await getDoc(mainDocRef);
    if (mainSnap.exists()) {
      return mainSnap.data() as CloudAppConnectionData;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch connection from Cloud Firestore:', err);
    return null;
  }
}

/**
 * Persists a single user to backend (Firestore + SQL mirror)
 */
export async function saveSingleUserToCloud(u: User): Promise<CloudSaveResult> {
  const payload = {
    uid: u.id || u.username,
    email: u.email || `${u.username}@system.local`,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    organizationId: u.organizationId || 'org_default',
    organizationName: u.organizationName,
    designation: u.designation,
    phone: u.phone,
    password: u.password,
    securityPin: u.securityPin || '1234',
    securityQuestion: u.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
    securityAnswer: u.securityAnswer || 'नेपाल',
    mustChangePassword: Boolean(u.mustChangePassword),
    isFirstLogin: Boolean(u.isFirstLogin),
    isActive: u.isActive !== undefined ? u.isActive : true,
    firebaseUid: u.firebaseUid || undefined,
    metadata: {
      password: u.password,
      securityPin: u.securityPin || '1234',
      securityQuestion: u.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: u.securityAnswer || 'नेपाल',
      mustChangePassword: Boolean(u.mustChangePassword),
      isFirstLogin: Boolean(u.isFirstLogin),
      organizationName: u.organizationName,
      phone: u.phone,
      designation: u.designation,
      isActive: u.isActive !== undefined ? u.isActive : true,
    },
  };

  try {
    const res = await authenticatedFetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const parsed = await parseApiError(res);
      const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
      return { ok: false, code: parsed.code, error: parsed.message, state };
    }
    return { ok: true };
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'Network error syncing user', state: 'SERVER' };
  }
}

export const saveCloudUser = saveSingleUserToCloud;

/**
 * Persists registered users list to backend
 */
export async function saveCloudUsers(usersList: User[]): Promise<CloudSaveResult> {
  const cleanUsers = deduplicateUsers(usersList);
  const formattedUsers = cleanUsers.map((u) => ({
    uid: u.id || u.username,
    email: u.email || `${u.username}@system.local`,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    organizationId: u.organizationId || 'org_default',
    organizationName: u.organizationName,
    designation: u.designation,
    phone: u.phone,
    firebaseUid: u.firebaseUid || undefined,
    metadata: {
      password: u.password,
      securityPin: u.securityPin || '1234',
      securityQuestion: u.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: u.securityAnswer || 'नेपाल',
      mustChangePassword: Boolean(u.mustChangePassword),
      isFirstLogin: Boolean(u.isFirstLogin),
      organizationName: u.organizationName,
      phone: u.phone,
      designation: u.designation,
      isActive: u.isActive !== undefined ? u.isActive : true,
    },
  }));

  try {
    const batchRes = await authenticatedFetch('/api/users/batch-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: formattedUsers }),
    });

    if (!batchRes.ok) {
      // Fallback to individual sync
      let errText = '';
      for (const payload of formattedUsers) {
        const indRes = await authenticatedFetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!indRes.ok) {
          errText = await indRes.text();
        }
      }
      if (errText) {
        return { ok: false, error: errText };
      }
    }
    return { ok: true };
  } catch (sqlErr: any) {
    return { ok: false, error: sqlErr?.message || 'Network error syncing users' };
  }
}


export function normalizeUserData(u: User): User {
  let fullName = u.fullName;
  if (
    u.username?.toLowerCase() === 'admin_mbp' &&
    (!fullName || fullName.trim() === 'Mahakali Bridge Project' || fullName.trim() === 'admin_mbp')
  ) {
    fullName = 'महाकाली पुल योजना, कंचनपुर';
  }
  return {
    ...u,
    fullName,
    organizationName:
      u.username?.toLowerCase() === 'admin_mbp' && (!u.organizationName || u.organizationName === 'default_org')
        ? 'महाकाली पुल योजना'
        : u.organizationName,
  };
}

/**
 * Authenticate directly against Cloud SQL backend API with Firestore fallback
 */
export async function cloudLogin(
  username: string,
  password?: string,
  firebaseUid?: string
): Promise<{
  success: boolean;
  user?: User;
  token?: string;
  mustChangePassword?: boolean;
  notFound?: boolean;
  wrongPassword?: boolean;
  inactive?: boolean;
  officeInactive?: boolean;
  message?: string;
}> {
  const cleanInput = (username || '').trim().toLowerCase();
  if (!cleanInput) {
    return { success: false, notFound: true, message: 'प्रयोगकर्ता नाम प्रविष्ट गर्नुहोस्।' };
  }

  // 1. Try backend authentication endpoint (Cloud SQL & Firestore with scrypt)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanInput, password, firebaseUid }),
    });
    const json = await res.json();
    if (json.success && json.user) {
      // Ensure isActive is boolean and user data is normalized
      const normalized = normalizeUserData(json.user);
      const userObj: User = {
        ...normalized,
        isActive: normalized.isActive !== false,
      };
      return {
        success: true,
        user: userObj,
        token: json.token,
        mustChangePassword: Boolean(json.mustChangePassword ?? userObj.mustChangePassword),
      };
    }
    if (json.wrongPassword || json.inactive || json.officeInactive) {
      return json;
    }
  } catch (err: any) {
    console.warn('Cloud login API error:', err);
  }

  // 2. Fallback: Check Firestore if backend API was unavailable
  try {
    let foundUserRaw: User | null = null;
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.users)) {
        foundUserRaw = data.users.find(
          (u: User) =>
            (u.username && u.username.toLowerCase() === cleanInput) ||
            (u.email && u.email.toLowerCase() === cleanInput) ||
            (u.id && u.id.toLowerCase() === cleanInput) ||
            (u.id && u.id === username.trim())
        ) || null;
      }
    }

    if (!foundUserRaw) {
      foundUserRaw = await getUserFromFirestore(cleanInput);
    }

    if (foundUserRaw) {
      const foundUser = normalizeUserData(foundUserRaw);
      if (foundUser.isActive === false) {
        return {
          success: false,
          inactive: true,
          message: 'यो खाता निष्क्रिय (Inactive) गरिएको छ। कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।',
        };
      }

      const userPass = foundUser.password || '';

      const safeFoundUser: User = {
        ...foundUser,
        isActive: Boolean(foundUser.isActive ?? true),
      };

      if (password === undefined || password === '') {
        return { success: true, user: safeFoundUser, mustChangePassword: Boolean(safeFoundUser.mustChangePassword) };
      }

      if (!userPass) {
        return { success: false, wrongPassword: true, message: 'खाताको पासवर्ड फेला परेन।' };
      }

      const passCheck = verifyPasswordSync(password, userPass);
      if (passCheck.isValid) {
        saveSingleUserToCloud(safeFoundUser).catch(() => {});
        return {
          success: true,
          user: safeFoundUser,
          mustChangePassword: Boolean(safeFoundUser.mustChangePassword),
        };
      } else {
        return { success: false, wrongPassword: true, message: 'गलत पासवर्ड प्रविष्ट भयो।' };
      }
    }
  } catch (fsErr) {
    console.warn('Firestore fallback login notice:', fsErr);
  }

  return {
    success: false,
    notFound: true,
    message: 'प्रविष्टि गरिएको प्रयोगकर्ता नाम (User ID) फेला परेन वा खाता निष्क्रिय छ।',
  };
}

/**
 * Fetches registered users list from Cloud SQL and Firestore with intelligent two-way merge.
 */
export async function getCloudUsers(): Promise<User[] | null> {
  let sqlUsers: User[] = [];

  // 1. Try Cloud SQL
  try {
    const res = await authenticatedFetch('/api/users');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.users) && json.users.length > 0) {
        sqlUsers = json.users.map((u: any) => ({
          id: u.uid || String(u.id),
          uid: u.uid,
          firebaseUid: u.firebaseUid || u.firebase_uid,
          username: u.username,
          fullName: u.fullName || u.full_name,
          email: u.email,
          role: u.role || 'GENERAL_USER',
          organizationId: u.organizationId || u.organization_id || 'org_default',
          organizationName: u.organizationName || u.organization_name || u.metadata?.organizationName,
          designation: u.designation || u.metadata?.designation,
          phone: u.phone || u.metadata?.phone,
          password: u.metadata?.password || (u.role === 'SUPER_ADMIN' ? 'admin123' : u.role === 'ADMIN' ? 'admin123' : 'viewer123'),
          securityPin: u.metadata?.securityPin || '1234',
          securityQuestion: u.metadata?.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
          securityAnswer: u.metadata?.securityAnswer || 'नेपाल',
          mustChangePassword: u.metadata?.mustChangePassword ?? false,
          isFirstLogin: u.metadata?.isFirstLogin ?? false,
          isActive: u.isActive !== undefined ? u.isActive !== false : (u.is_active !== undefined ? u.is_active !== false : true),
          createdAt: u.createdAt || u.created_at || new Date().toISOString(),
        })) as User[];
      }
    }
  } catch (sqlErr) {
    console.warn('Could not fetch users from Cloud SQL:', sqlErr);
  }

  // 2. Fetch from Firestore and merge
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.users) && data.users.length > 0) {
        const mergedMap = new Map<string, User>();
        for (const u of sqlUsers) {
          if (u.username) mergedMap.set(u.username.toLowerCase(), u);
        }
        for (const fu of data.users) {
          if (fu.username) {
            const key = fu.username.toLowerCase();
            const existing = mergedMap.get(key);
            if (!existing) {
              const cleanFu: User = {
                ...fu,
                isActive: fu.isActive !== false,
              };
              mergedMap.set(key, cleanFu);
              saveSingleUserToCloud(cleanFu).catch(() => {});
            } else {
              // Intelligent field-level merge:
              // Preserve password hash if Firestore has it or if SQL has fallback default
              const resolvedPassword =
                (fu.password && fu.password.startsWith('sha256:'))
                  ? fu.password
                  : (existing.password && existing.password.startsWith('sha256:'))
                  ? existing.password
                  : (fu.password || existing.password);

              const mergedUser: User = {
                ...existing,
                ...fu,
                password: resolvedPassword,
                securityPin: fu.securityPin || existing.securityPin || '1234',
                securityQuestion: fu.securityQuestion || existing.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
                securityAnswer: fu.securityAnswer || existing.securityAnswer || 'नेपाल',
                mustChangePassword: fu.mustChangePassword ?? existing.mustChangePassword ?? false,
                isFirstLogin: fu.isFirstLogin ?? existing.isFirstLogin ?? false,
                isActive: fu.isActive !== undefined ? fu.isActive !== false : (existing.isActive !== undefined ? existing.isActive !== false : true),
                organizationId: fu.organizationId || existing.organizationId || 'org_default',
                organizationName: fu.organizationName || existing.organizationName,
              };
              mergedMap.set(key, mergedUser);
            }
          }
        }
        const normalizedList = deduplicateUsers(Array.from(mergedMap.values()).map(normalizeUserData));
        return normalizedList;
      }
    }
  } catch (err) {
    console.warn('Could not fetch users from Cloud Firestore:', err);
  }

  return sqlUsers.length > 0 ? deduplicateUsers(sqlUsers.map(normalizeUserData)) : null;
}

/**
 * Persists a generic system setting to backend
 */
export async function saveCloudSystemSetting(key: string, data: any): Promise<CloudSaveResult> {
  try {
    const res = await authenticatedFetch(`/api/settings/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || 'Failed to save system setting' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error saving system setting' };
  }
}

/**
 * Removes a deleted user account from backend
 */
export async function deleteCloudUser(userId: string, officeId?: string): Promise<CloudSaveResult> {
  if (!userId) return { ok: false, error: 'User ID is required' };

  // 1. Backend API
  try {
    const res = await authenticatedFetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const parsed = await parseApiError(res);
      const state = res.status >= 500 ? 'SERVER' : res.status === 400 ? 'VALIDATION' : 'UNKNOWN';
      return { ok: false, code: parsed.code, error: parsed.message, state };
    }
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      return { ok: false, code: err.code, error: err.message, state: err.state };
    }
    return { ok: false, code: 'NETWORK_ERROR', error: err?.message || 'Network error deleting user', state: 'SERVER' };
  }

  if (officeId && officeId !== 'all') {
    try {
      await authenticatedFetch(`/api/offices/${encodeURIComponent(officeId)}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    } catch {}
  }

  // 2. Direct Firestore cleanup
  if (canWriteFirestore()) {
    try {
      const { deleteUserFromFirestore } = await import('./firestoreService');
      await deleteUserFromFirestore(userId, officeId);
    } catch (fsErr) {
      handleFirestoreWriteError(fsErr, 'deleteCloudUser');
    }
  }

  return { ok: true };
}

/**
 * Deletes a fiscal year record from the backend
 */
export async function deleteCloudFiscalYear(orgId: string, fiscalYear: string): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(orgId)}/fiscal-years/${encodeURIComponent(fiscalYear)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not delete fiscal year from backend API:', err);
    return false;
  }
}

/**
 * Clears fiscal year payroll and employee data on backend
 */
export async function clearCloudFiscalYearData(orgId: string, fiscalYear: string): Promise<boolean> {
  try {
    const res = await authenticatedFetch(`/api/offices/${encodeURIComponent(orgId)}/fiscal-years/${encodeURIComponent(fiscalYear)}/clear`, {
      method: 'POST',
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not clear fiscal year data on backend API:', err);
    return false;
  }
}

/**
 * Executes a full system wipe / factory reset on backend
 */
export async function factoryResetCloudData(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await authenticatedFetch('/api/system/clear-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message };
    }
    const errText = await res.text();
    return { success: false, message: errText || 'Factory reset failed on server' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error during factory reset' };
  }
}


/**
 * Searches and retrieves a single user by username or email from Cloud SQL or Firestore.
 * Critical for multi-device authentication and account recovery on fresh devices.
 */
export async function lookupCloudUser(usernameOrEmail: string): Promise<User | null> {
  if (!usernameOrEmail || !usernameOrEmail.trim()) return null;
  const clean = usernameOrEmail.trim().toLowerCase();

  // 1. Try Cloud SQL lookup endpoint
  try {
    const res = await authenticatedFetch(`/api/users/lookup?q=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.user) {
        const u = json.user;
        const meta = u.metadata || {};
        return {
          id: u.uid || String(u.id),
          uid: u.uid,
          firebaseUid: u.firebaseUid || u.firebase_uid,
          username: u.username,
          fullName: u.fullName || u.full_name,
          email: u.email,
          role: u.role || 'GENERAL_USER',
          organizationId: u.organizationId || u.organization_id || 'org_default',
          organizationName: u.organizationName || u.organization_name || meta.organizationName,
          designation: u.designation || meta.designation,
          phone: u.phone || meta.phone,
          password: meta.password,
          securityPin: meta.securityPin || '1234',
          securityQuestion: meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
          securityAnswer: meta.securityAnswer || 'नेपाल',
          mustChangePassword: Boolean(meta.mustChangePassword),
          isFirstLogin: Boolean(meta.isFirstLogin),
          isActive: u.isActive !== undefined ? u.isActive !== false : true,
          createdAt: u.createdAt || new Date().toISOString(),
        };
      }
    }
  } catch (e) {
    console.warn('Cloud SQL lookup warning:', e);
  }

  // 2. Fallback to Firestore
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.users)) {
        const found = data.users.find(
          (u: User) =>
            (u.username && u.username.toLowerCase() === clean) ||
            (u.email && u.email.toLowerCase() === clean) ||
            (u.id && u.id.toLowerCase() === clean) ||
            (u.id && u.id === usernameOrEmail.trim())
        );
        if (found) {
          return {
            ...found,
            isActive: found.isActive !== false,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Firestore user lookup fallback warning:', e);
  }

  return null;
}

/**
 * Persists System Support Contact (help phone, email, whatsapp, note) to Cloud SQL and Firestore
 */
export async function saveCloudSupportContact(
  contact: SystemSupportContact,
  updatedBy?: string
): Promise<CloudSaveResult> {
  const cleanContact: SystemSupportContact = {
    phone: (contact.phone || '').trim(),
    email: (contact.email || '').trim(),
    whatsapp: (contact.whatsapp || '').trim(),
    supportNote: (contact.supportNote || '').trim(),
  };

  try {
    const res = await authenticatedFetch('/api/settings/system_support_contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cleanContact, updatedBy }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || 'Failed to save support contact' };
    }
    return { ok: true };
  } catch (sqlErr: any) {
    console.warn('Could not save support contact to Cloud SQL API:', sqlErr);
    return { ok: false, error: sqlErr?.message || 'Network error saving support contact' };
  }
}

/**
 * Retrieves the persisted System Support Contact from Cloud SQL or Firestore.
 */
export async function getCloudSupportContact(): Promise<SystemSupportContact | null> {
  // 1. Try fetching from Cloud SQL backend API
  try {
    const res = await fetch('/api/settings/system_support_contact');
    if (res.ok) {
      const json = await res.json();
      if (json.data && (json.data.phone || json.data.email || json.data.whatsapp || json.data.supportNote)) {
        return {
          phone: json.data.phone || '',
          email: json.data.email || '',
          whatsapp: json.data.whatsapp || '',
          supportNote: json.data.supportNote || '',
        };
      }
    }
  } catch (sqlErr) {
    console.warn('Could not fetch support contact from Cloud SQL API:', sqlErr);
  }

  // 2. Try Firestore fallback
  try {
    const contactDocRef = doc(db, CONNECTIONS_COLLECTION, 'system_support_contact');
    const snap = await getDoc(contactDocRef);
    if (snap.exists()) {
      const d = snap.data();
      if (d && (d.phone || d.email || d.whatsapp || d.supportNote)) {
        return {
          phone: d.phone || '',
          email: d.email || '',
          whatsapp: d.whatsapp || '',
          supportNote: d.supportNote || '',
        };
      }
    }

    // Try main config doc fallback
    const mainDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    const mainSnap = await getDoc(mainDocRef);
    if (mainSnap.exists()) {
      const md = mainSnap.data();
      if (md?.supportContact && (md.supportContact.phone || md.supportContact.email || md.supportContact.whatsapp || md.supportContact.supportNote)) {
        return {
          phone: md.supportContact.phone || '',
          email: md.supportContact.email || '',
          whatsapp: md.supportContact.whatsapp || '',
          supportNote: md.supportContact.supportNote || '',
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch support contact from Cloud Firestore:', err);
    return null;
  }
}
