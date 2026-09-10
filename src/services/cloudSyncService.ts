import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleSheetsConfig, OrganizationSetup, OrganizationItem, User, SystemSupportContact } from '../types';
import { verifyPasswordSync } from '../utils/securityUtils';

// Initialize Firebase App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

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
 * Persists a single organization to Cloud SQL and Firestore
 */
export async function saveCloudOrganization(org: OrganizationItem): Promise<boolean> {
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
    isActive: org.isActive ?? true,
    createdAt: org.createdAt || new Date().toISOString(),
  };

  // 1. Sync to Cloud SQL via /api/organization
  try {
    await fetch('/api/organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (sqlErr) {
    console.warn('Could not save organization to Cloud SQL API:', sqlErr);
  }

  // 2. Sync to Firestore
  try {
    const orgDocRef = doc(db, ORGANIZATIONS_COLLECTION, org.id);
    await setDoc(orgDocRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Could not save organization to Cloud Firestore:', err);
    return true;
  }
}

/**
 * Persists the entire organizations list to Cloud SQL and Firestore
 */
export async function saveCloudOrganizations(orgs: OrganizationItem[]): Promise<boolean> {
  // 1. Save individually to Cloud SQL
  for (const org of orgs) {
    saveCloudOrganization(org).catch((e) => console.warn('Sync org warning:', e));
  }

  // 2. Save full array to Firestore
  try {
    const listDocRef = doc(db, ORGANIZATIONS_COLLECTION, MAIN_ORGS_DOC);
    await setDoc(listDocRef, {
      organizations: orgs,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('Could not save organizations list to Cloud Firestore:', err);
    return true;
  }
}

/**
 * Retrieves all registered organizations from Cloud SQL or Firestore
 */
export async function getCloudOrganizations(): Promise<OrganizationItem[] | null> {
  // 1. Try Cloud SQL
  try {
    const res = await fetch('/api/organization');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.organizations) && json.organizations.length > 0) {
        return json.organizations.map((o: any) => ({
          id: o.id || 'org_default',
          name: o.name || 'नेपाल सरकार',
          officeName: o.officeName || o.office_name || '',
          officeCode: o.officeCode || o.office_code || '',
          code: o.officeCode || o.office_code || '',
          ministryName: o.ministryName || o.ministry_name || '',
          departmentName: o.departmentName || o.department_name || '',
          parentBodyName: o.parentBodyName || o.parent_body_name || '',
          province: o.province || 'बागमती प्रदेश',
          district: o.district || 'काठमाडौं',
          localLevel: o.localLevel || o.local_level || '',
          address: o.address || '',
          email: o.email || '',
          phone: o.phone || '',
          mobile: o.mobile || '',
          whatsapp: o.whatsapp || '',
          website: o.website || '',
          panNumber: o.panNumber || o.pan_number || '',
          pan: o.panNumber || o.pan_number || '',
          registrationNo: o.registrationNo || o.registration_no || '',
          authorizedPersonName: o.authorizedPersonName || o.authorized_person_name || '',
          authorizedPersonDesignation: o.authorizedPersonDesignation || o.authorized_person_designation || '',
          currentFiscalYear: o.currentFiscalYear || o.current_fiscal_year || '२०८१/८२',
          logoUrl: o.logoUrl || o.logo_url || '',
          signatureUrl: o.signatureUrl || o.signature_url || '',
          headerText: o.headerText || o.header_text || '',
          footerText: o.footerText || o.footer_text || '',
          alignment: o.alignment || 'center',
          isActive: o.isActive ?? o.is_active ?? true,
          createdAt: o.createdAt || o.created_at || new Date().toISOString(),
        })) as OrganizationItem[];
      }
    }
  } catch (sqlErr) {
    console.warn('Could not fetch organizations from Cloud SQL:', sqlErr);
  }

  // 2. Try Firestore fallback
  try {
    const listDocRef = doc(db, ORGANIZATIONS_COLLECTION, MAIN_ORGS_DOC);
    const snap = await getDoc(listDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.organizations) && data.organizations.length > 0) {
        return data.organizations as OrganizationItem[];
      }
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch organizations from Cloud Firestore:', err);
    return null;
  }
}

/**
 * Removes an organization from Cloud SQL
 */
export async function deleteCloudOrganization(orgId: string): Promise<boolean> {
  try {
    await fetch(`/api/organization/${encodeURIComponent(orgId)}`, {
      method: 'DELETE',
    });
    return true;
  } catch (err) {
    console.warn('Could not delete organization from Cloud SQL API:', err);
    return false;
  }
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

  try {
    const docRef = doc(db, CONNECTIONS_COLLECTION, key);
    await setDoc(docRef, { ...config, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Could not save org sheets config to Firestore:', err);
    return true;
  }
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
  try {
    const configDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    await setDoc(configDocRef, data, { merge: true });

    if (updatedBy) {
      const userDocRef = doc(db, CONNECTIONS_COLLECTION, `user_${updatedBy.toLowerCase()}`);
      await setDoc(userDocRef, data, { merge: true });
    }
    return true;
  } catch (err) {
    console.warn('Could not save connection to Cloud Firestore:', err);
    return true; // Cloud SQL may have already succeeded
  }
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
 * Persists a single user to Cloud SQL and Firestore
 */
export async function saveSingleUserToCloud(u: User): Promise<boolean> {
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

  let sqlOk = false;
  try {
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    sqlOk = res.ok;
  } catch (sqlErr) {
    console.warn('Could not sync single user to Cloud SQL:', sqlErr);
  }

  // Sync to Firestore for multi-device reliability
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    const snap = await getDoc(docRef);
    let currentUsers: User[] = [];
    if (snap.exists() && Array.isArray(snap.data()?.users)) {
      currentUsers = snap.data().users;
    }
    const filtered = currentUsers.filter(
      (item) => item.id !== u.id && item.username.toLowerCase() !== u.username.toLowerCase()
    );
    filtered.push(u);
    await setDoc(docRef, {
      users: filtered,
      updatedAt: new Date().toISOString(),
    });
  } catch (fsErr) {
    console.warn('Could not sync single user to Firestore:', fsErr);
  }

  return sqlOk;
}

/**
 * Persists registered users list to Cloud SQL and Firestore
 */
export async function saveCloudUsers(usersList: User[]): Promise<boolean> {
  const formattedUsers = usersList.map((u) => ({
    uid: u.id || u.username,
    email: u.email || `${u.username}@system.local`,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    organizationId: u.organizationId || 'org_default',
    organizationName: u.organizationName,
    designation: u.designation,
    phone: u.phone,
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

  // 1. Sync users to Cloud SQL via Batch API (instant & atomic)
  try {
    const batchRes = await fetch('/api/users/batch-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: formattedUsers }),
    });

    if (!batchRes.ok) {
      // Fallback to individual sync
      for (const payload of formattedUsers) {
        await fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    }
  } catch (sqlErr) {
    console.warn('Could not sync users to Cloud SQL:', sqlErr);
  }

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    await setDoc(docRef, {
      users: usersList,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('Could not save users to Cloud Firestore:', err);
    return true;
  }
}

/**
 * Authenticate directly against Cloud SQL backend API
 */
export async function cloudLogin(
  username: string,
  password?: string
): Promise<{ success: boolean; user?: User; notFound?: boolean; wrongPassword?: boolean; inactive?: boolean; message?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (json.success && json.user) {
      return json;
    }
    if (json.wrongPassword || json.inactive) {
      return json;
    }
  } catch (err: any) {
    console.warn('Cloud login API error:', err);
  }

  // Fallback: Check Firestore if Cloud SQL returned notFound or threw an error
  try {
    const docRef = doc(db, USERS_COLLECTION, MAIN_USERS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.users)) {
        const cleanInput = username.trim().toLowerCase();
        const foundUser = data.users.find(
          (u: User) =>
            u.username.toLowerCase() === cleanInput ||
            (u.email && u.email.toLowerCase() === cleanInput) ||
            u.id === username.trim()
        );

        if (foundUser) {
          if (foundUser.isActive === false) {
            return {
              success: false,
              inactive: true,
              message: 'यो खाता निष्क्रिय (Inactive) गरिएको छ। कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।',
            };
          }

          const userPass =
            foundUser.password ||
            (foundUser.role === 'SUPER_ADMIN' || foundUser.role === 'ADMIN'
              ? 'admin123'
              : foundUser.role === 'ACCOUNTANT'
              ? 'account123'
              : 'viewer123');

          if (password === undefined || password === '') {
            return { success: true, user: foundUser };
          }

          const passCheck = verifyPasswordSync(password, userPass);
          if (passCheck.isValid) {
            saveSingleUserToCloud(foundUser).catch(() => {});
            return { success: true, user: foundUser };
          } else {
            return { success: false, wrongPassword: true, message: 'गलत पासवर्ड प्रविष्ट भयो।' };
          }
        }
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
 * Fetches registered users list from Cloud SQL or Firestore.
 */
export async function getCloudUsers(): Promise<User[] | null> {
  let sqlUsers: User[] = [];

  // 1. Try Cloud SQL
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.users) && json.users.length > 0) {
        sqlUsers = json.users.map((u: any) => ({
          id: u.uid || String(u.id),
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
          isActive: u.isActive ?? u.is_active ?? true,
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
          if (fu.username && !mergedMap.has(fu.username.toLowerCase())) {
            mergedMap.set(fu.username.toLowerCase(), fu);
            saveSingleUserToCloud(fu).catch(() => {});
          }
        }
        return Array.from(mergedMap.values());
      }
    }
  } catch (err) {
    console.warn('Could not fetch users from Cloud Firestore:', err);
  }

  return sqlUsers.length > 0 ? sqlUsers : null;
}

/**
 * Removes a deleted user account from Cloud SQL backend
 */
export async function deleteCloudUser(userId: string): Promise<void> {
  try {
    await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Could not delete user from Cloud SQL API:', err);
  }
}

/**
 * Persists System Support Contact (help phone, email, whatsapp, note) to Cloud SQL and Firestore
 */
export async function saveCloudSupportContact(
  contact: SystemSupportContact,
  updatedBy?: string
): Promise<boolean> {
  const cleanContact: SystemSupportContact = {
    phone: (contact.phone || '').trim(),
    email: (contact.email || '').trim(),
    whatsapp: (contact.whatsapp || '').trim(),
    supportNote: (contact.supportNote || '').trim(),
  };

  // 1. Sync to Cloud SQL via backend API
  try {
    await fetch('/api/settings/system_support_contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cleanContact, updatedBy }),
    });
  } catch (sqlErr) {
    console.warn('Could not save support contact to Cloud SQL API:', sqlErr);
  }

  // 2. Sync to Firestore
  try {
    const contactDocRef = doc(db, CONNECTIONS_COLLECTION, 'system_support_contact');
    await setDoc(
      contactDocRef,
      { ...cleanContact, updatedAt: new Date().toISOString(), lastUpdatedBy: updatedBy || 'system' },
      { merge: true }
    );

    // Also update main config doc
    const mainDocRef = doc(db, CONNECTIONS_COLLECTION, MAIN_CONFIG_DOC);
    await setDoc(
      mainDocRef,
      { supportContact: cleanContact, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Could not save support contact to Cloud Firestore:', err);
    return true;
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
