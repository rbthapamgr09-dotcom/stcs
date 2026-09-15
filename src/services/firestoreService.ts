import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  OrganizationItem,
  User,
  FiscalYearData,
  SystemSupportContact,
} from '../types';

/**
 * Firestore Service Layer
 * Multi-Tenant Cloud Firestore Architecture
 * 
 * Hierarchy:
 * - offices/{officeId}
 * - offices/{officeId}/fiscal_years/{fiscalYear}
 * - offices/{officeId}/audit_logs/{logId}
 * - users/{userId}
 * - system_settings/{settingKey}
 */

// ==========================================
// 1. OFFICE / INSTITUTION MANAGEMENT
// ==========================================

export async function saveOfficeToFirestore(office: OrganizationItem): Promise<boolean> {
  if (!office || !office.id) return false;
  try {
    const cleanOffice: OrganizationItem = {
      ...office,
      updatedAt: new Date().toISOString(),
    };
    const officeDocRef = doc(db, 'offices', office.id);
    await setDoc(officeDocRef, cleanOffice, { merge: true });

    // Also mirror to legacy registered_offices for smooth backward compatibility
    try {
      const legacyRef = doc(db, 'system_organizations', 'registered_offices');
      const snap = await getDoc(legacyRef);
      let currentList: OrganizationItem[] = [];
      if (snap.exists() && Array.isArray(snap.data().organizations)) {
        currentList = snap.data().organizations;
      }
      const existingIdx = currentList.findIndex((o) => o.id === office.id);
      if (existingIdx >= 0) {
        currentList[existingIdx] = cleanOffice;
      } else {
        currentList.push(cleanOffice);
      }
      await setDoc(legacyRef, { organizations: currentList, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      // Legacy mirror failure non-blocking
    }

    return true;
  } catch (err: any) {
    console.error(`[Firestore] Error saving office ${office.id}:`, err?.message || err);
    return false;
  }
}

export async function getOfficesFromFirestore(): Promise<OrganizationItem[]> {
  try {
    const collRef = collection(db, 'offices');
    const snap = await getDocs(collRef);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ ...(d.data() as OrganizationItem), id: d.id }));
    }

    // Fallback: check legacy registered_offices
    const legacyRef = doc(db, 'system_organizations', 'registered_offices');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists() && Array.isArray(legacySnap.data().organizations)) {
      return legacySnap.data().organizations;
    }

    return [];
  } catch (err: any) {
    console.warn('[Firestore] Notice fetching offices:', err?.message || err);
    return [];
  }
}

export async function getOfficeByIdFromFirestore(officeId: string): Promise<OrganizationItem | null> {
  if (!officeId) return null;
  try {
    const officeDocRef = doc(db, 'offices', officeId);
    const snap = await getDoc(officeDocRef);
    if (snap.exists()) {
      return { ...(snap.data() as OrganizationItem), id: snap.id };
    }
    return null;
  } catch (err: any) {
    console.warn(`[Firestore] Notice fetching office ${officeId}:`, err?.message || err);
    return null;
  }
}

export async function deleteOfficeFromFirestore(officeId: string): Promise<boolean> {
  if (!officeId) return false;
  try {
    const officeDocRef = doc(db, 'offices', officeId);
    await deleteDoc(officeDocRef);

    // Also update legacy list
    try {
      const legacyRef = doc(db, 'system_organizations', 'registered_offices');
      const snap = await getDoc(legacyRef);
      if (snap.exists() && Array.isArray(snap.data().organizations)) {
        const filtered = snap.data().organizations.filter((o: any) => o.id !== officeId);
        await setDoc(legacyRef, { organizations: filtered, updatedAt: new Date().toISOString() });
      }
    } catch {}

    return true;
  } catch (err: any) {
    console.error(`[Firestore] Error deleting office ${officeId}:`, err?.message || err);
    return false;
  }
}

export function subscribeToOffices(onUpdate: (offices: OrganizationItem[]) => void): () => void {
  try {
    const collRef = collection(db, 'offices');
    return onSnapshot(
      collRef,
      (snap) => {
        const offices = snap.docs.map((d) => ({ ...(d.data() as OrganizationItem), id: d.id }));
        onUpdate(offices);
      },
      (err) => {
        console.warn('[Firestore] subscribeToOffices snapshot notice:', err?.message || err);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// ==========================================
// 2. MULTI-TENANT FISCAL YEAR PAYROLL DATA
// ==========================================

export async function saveFiscalYearDataToFirestore(
  officeId: string,
  fiscalYear: string,
  data: FiscalYearData,
  actor?: string
): Promise<boolean> {
  if (!officeId || !fiscalYear) return false;
  try {
    const fyDocRef = doc(db, 'offices', officeId, 'fiscal_years', fiscalYear);
    const payload = {
      officeId,
      fiscalYear,
      employees: data.employees || [],
      salarySetups: data.salarySetups || {},
      deductionSetups: data.deductionSetups || {},
      taxReferences: data.taxReferences || [],
      updatedAt: new Date().toISOString(),
      updatedBy: actor || 'system',
    };
    await setDoc(fyDocRef, payload, { merge: true });
    return true;
  } catch (err: any) {
    console.error(`[Firestore] Error saving FY data for ${officeId}/${fiscalYear}:`, err?.message || err);
    return false;
  }
}

export async function getFiscalYearDataFromFirestore(
  officeId: string,
  fiscalYear: string
): Promise<FiscalYearData | null> {
  if (!officeId || !fiscalYear) return null;
  try {
    const fyDocRef = doc(db, 'offices', officeId, 'fiscal_years', fiscalYear);
    const snap = await getDoc(fyDocRef);
    if (snap.exists()) {
      const d = snap.data();
      return {
        employees: d.employees || [],
        salarySetups: d.salarySetups || {},
        deductionSetups: d.deductionSetups || {},
        taxReferences: d.taxReferences || [],
      };
    }
    return null;
  } catch (err: any) {
    console.warn(`[Firestore] Notice fetching FY data for ${officeId}/${fiscalYear}:`, err?.message || err);
    return null;
  }
}

export function subscribeToOfficeFiscalYear(
  officeId: string,
  fiscalYear: string,
  onUpdate: (data: FiscalYearData) => void
): () => void {
  if (!officeId || !fiscalYear) return () => {};
  try {
    const fyDocRef = doc(db, 'offices', officeId, 'fiscal_years', fiscalYear);
    return onSnapshot(
      fyDocRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          onUpdate({
            employees: d.employees || [],
            salarySetups: d.salarySetups || {},
            deductionSetups: d.deductionSetups || {},
            taxReferences: d.taxReferences || [],
          });
        }
      },
      (err) => {
        console.warn(`[Firestore] Real-time FY listener notice for ${officeId}/${fiscalYear}:`, err?.message || err);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// ==========================================
// 3. USER MANAGEMENT & AUTHENTICATION
// ==========================================

export async function saveUserToFirestore(user: User): Promise<boolean> {
  if (!user || (!user.id && !user.username)) return false;
  const docId = user.id || `user_${user.username.toLowerCase()}`;
  try {
    const userDocRef = doc(db, 'users', docId);
    const safeData: Partial<User> = {
      id: docId,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId || 'org_default',
      organizationName: user.organizationName || '',
      email: user.email || '',
      phone: user.phone || '',
      designation: user.designation || '',
      securityPin: user.securityPin || '1234',
      securityQuestion: user.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: user.securityAnswer || 'नेपाल',
      isActive: user.isActive ?? true,
      mustChangePassword: user.mustChangePassword ?? false,
      isFirstLogin: user.isFirstLogin ?? false,
      createdAt: user.createdAt || new Date().toISOString(),
      lastLogin: user.lastLogin || '',
    };
    await setDoc(userDocRef, safeData, { merge: true });

    // Also mirror to office users subcollection if officeId is specific
    if (user.organizationId && user.organizationId !== 'all') {
      try {
        const officeUserRef = doc(db, 'offices', user.organizationId, 'users', docId);
        await setDoc(officeUserRef, safeData, { merge: true });
      } catch {}
    }

    // Mirror to legacy registered_accounts
    try {
      const legacyRef = doc(db, 'system_users', 'registered_accounts');
      const snap = await getDoc(legacyRef);
      let currentList: User[] = [];
      if (snap.exists() && Array.isArray(snap.data().users)) {
        currentList = snap.data().users;
      }
      const existingIdx = currentList.findIndex(
        (u) => u.id === docId || u.username.toLowerCase() === user.username.toLowerCase()
      );
      if (existingIdx >= 0) {
        currentList[existingIdx] = { ...currentList[existingIdx], ...safeData } as User;
      } else {
        currentList.push(safeData as User);
      }
      await setDoc(legacyRef, { users: currentList, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {}

    return true;
  } catch (err: any) {
    console.error(`[Firestore] Error saving user ${user.username}:`, err?.message || err);
    return false;
  }
}

export async function getUserFromFirestore(usernameOrId: string): Promise<User | null> {
  if (!usernameOrId) return null;
  const clean = usernameOrId.trim().toLowerCase();
  try {
    // 1. Direct doc lookup
    const directDocRef = doc(db, 'users', usernameOrId);
    const snap = await getDoc(directDocRef);
    if (snap.exists()) {
      return snap.data() as User;
    }

    // 2. Query by username
    const collRef = collection(db, 'users');
    const q = query(collRef, where('username', '==', clean));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as User;
    }

    // 3. Check legacy registered_accounts
    const legacyRef = doc(db, 'system_users', 'registered_accounts');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists() && Array.isArray(legacySnap.data().users)) {
      const found = legacySnap.data().users.find(
        (u: User) =>
          u.id === usernameOrId ||
          (u.username && u.username.toLowerCase() === clean) ||
          (u.email && u.email.toLowerCase() === clean)
      );
      if (found) return found;
    }

    return null;
  } catch (err: any) {
    console.warn(`[Firestore] Notice fetching user ${usernameOrId}:`, err?.message || err);
    return null;
  }
}

export async function getUsersFromFirestore(officeId?: string): Promise<User[]> {
  try {
    const collRef = collection(db, 'users');
    let snap;
    if (officeId && officeId !== 'all') {
      const q = query(collRef, where('organizationId', '==', officeId));
      snap = await getDocs(q);
    } else {
      snap = await getDocs(collRef);
    }

    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as User);
    }

    // Legacy fallback
    const legacyRef = doc(db, 'system_users', 'registered_accounts');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists() && Array.isArray(legacySnap.data().users)) {
      const list = legacySnap.data().users as User[];
      if (officeId && officeId !== 'all') {
        return list.filter((u) => u.organizationId === officeId || u.organizationId === 'all');
      }
      return list;
    }

    return [];
  } catch (err: any) {
    console.warn('[Firestore] Notice fetching users list:', err?.message || err);
    return [];
  }
}

export async function deleteUserFromFirestore(userId: string, officeId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);

    if (officeId && officeId !== 'all') {
      try {
        const officeUserRef = doc(db, 'offices', officeId, 'users', userId);
        await deleteDoc(officeUserRef);
      } catch {}
    }

    // Update legacy list
    try {
      const legacyRef = doc(db, 'system_users', 'registered_accounts');
      const snap = await getDoc(legacyRef);
      if (snap.exists() && Array.isArray(snap.data().users)) {
        const filtered = snap.data().users.filter((u: any) => u.id !== userId && u.username !== userId);
        await setDoc(legacyRef, { users: filtered, updatedAt: new Date().toISOString() });
      }
    } catch {}

    return true;
  } catch (err: any) {
    console.error(`[Firestore] Error deleting user ${userId}:`, err?.message || err);
    return false;
  }
}

export function subscribeToUsers(onUpdate: (users: User[]) => void, officeId?: string): () => void {
  try {
    const collRef = collection(db, 'users');
    let q = collRef as any;
    if (officeId && officeId !== 'all') {
      q = query(collRef, where('organizationId', '==', officeId));
    }
    return onSnapshot(
      q,
      (snap: any) => {
        const users = snap.docs.map((d: any) => d.data() as User);
        onUpdate(users);
      },
      (err: any) => {
        console.warn('[Firestore] subscribeToUsers snapshot notice:', err?.message || err);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// ==========================================
// 4. AUDIT LOGGING (OFFICE-SCOPED)
// ==========================================

export async function logOfficeAuditEvent(event: {
  officeId: string;
  actorUid: string;
  actorRole: string;
  action: string;
  details: string;
}): Promise<void> {
  if (!event.officeId) return;
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const logRef = doc(db, 'offices', event.officeId, 'audit_logs', logId);
    await setDoc(logRef, {
      ...event,
      id: logId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firestore] Audit log notice:', err);
  }
}

// ==========================================
// 5. SYSTEM SETTINGS (SUPPORT CONTACT)
// ==========================================

export async function saveSupportContactToFirestore(contact: SystemSupportContact): Promise<boolean> {
  try {
    const settingRef = doc(db, 'system_settings', 'support_contact');
    await setDoc(settingRef, {
      ...contact,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Also mirror to legacy system_connections for seamless migration
    try {
      const legacyRef = doc(db, 'system_connections', 'system_support_contact');
      await setDoc(legacyRef, { ...contact, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {}

    return true;
  } catch (err: any) {
    console.error('[Firestore] Error saving support contact:', err?.message || err);
    return false;
  }
}

export async function getSupportContactFromFirestore(): Promise<SystemSupportContact | null> {
  try {
    const settingRef = doc(db, 'system_settings', 'support_contact');
    const snap = await getDoc(settingRef);
    if (snap.exists()) {
      return snap.data() as SystemSupportContact;
    }

    // Fallback to legacy
    const legacyRef = doc(db, 'system_connections', 'system_support_contact');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      return legacySnap.data() as SystemSupportContact;
    }

    return null;
  } catch (err) {
    return null;
  }
}

// ==========================================
// 6. ONE-TIME MIGRATION: SHEETS -> FIRESTORE
// ==========================================

export async function oneTimeMigrateSpreadsheetToFirestore(
  spreadsheetId: string,
  accessToken: string,
  targetOfficeId: string,
  fiscalYear: string
): Promise<{ success: boolean; message: string; employeeCount?: number }> {
  if (!spreadsheetId) {
    return { success: false, message: 'गुगल स्प्रेडसिट आईडी आवश्यक छ।' };
  }
  if (!targetOfficeId) {
    return { success: false, message: 'माइग्रेसनका लागि गन्तव्य कार्यालय (Office ID) आवश्यक छ।' };
  }

  try {
    // Dynamic import to keep Google Sheets API out of main runtime path
    const { pullDataFromGoogleSpreadsheet } = await import('./googleSheetsService');
    const result = await pullDataFromGoogleSpreadsheet(accessToken, spreadsheetId);

    if (!result.success || !result.data) {
      return {
        success: false,
        message: result.message || 'गुगल सिट्सबाट डाटा पढ्न सकिएन।',
      };
    }

    const { employees, salarySetups, deductionSetups, taxReferences } = result.data;

    // Save directly to Firestore multi-tenant location
    await saveFiscalYearDataToFirestore(
      targetOfficeId,
      fiscalYear,
      {
        employees: employees || [],
        salarySetups: salarySetups || {},
        deductionSetups: deductionSetups || {},
        taxReferences: taxReferences || [],
      },
      'one_time_migration'
    );

    await logOfficeAuditEvent({
      officeId: targetOfficeId,
      actorUid: 'SUPER_ADMIN',
      actorRole: 'SUPER_ADMIN',
      action: 'ONE_TIME_SHEETS_MIGRATION',
      details: `गुगल सिट (${spreadsheetId}) बाट ${employees?.length || 0} जना कर्मचारीको विवरण Firestore मा माइग्रेट गरियो।`,
    });

    return {
      success: true,
      message: `सफलतापूर्वक ${employees?.length || 0} जना कर्मचारीको विवरण Google Sheets बाट Firestore मा सुरक्षित गरियो। अब यो कार्यालय पूर्ण रूपमा Firestore मा आधारित छ।`,
      employeeCount: employees?.length || 0,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'माइग्रेसन प्रक्रियामा प्राविधिक त्रुटि आयो।',
    };
  }
}
