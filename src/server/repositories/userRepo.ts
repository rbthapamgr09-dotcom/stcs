import { adminDb, adminAuth } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import {
  localSaveUser,
  localGetUserByUid,
  localGetUserByUsername,
  localListUsers,
  localDeleteUser,
} from './localStore.ts';
import {
  getOrCreateUser as sqlGetOrCreateUser,
  getUserByUid as sqlGetUserByUid,
  getUserByFirebaseUid as sqlGetUserByFirebaseUid,
  getUserByUsernameOrEmailOrUid as sqlGetUserByUsernameOrEmailOrUid,
  getUsers as sqlGetUsers,
  getUsersByOrganization as sqlGetUsersByOrganization,
  deleteUserByUid as sqlDeleteUserByUid,
  linkFirebaseUidToUser as sqlLinkFirebaseUidToUser,
} from '../../db/users.ts';

export interface UserEntity {
  id: string;
  uid: string;
  firebaseUid?: string;
  username: string;
  fullName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'GENERAL_USER' | 'VIEWER';
  organizationId: string;
  organizationName?: string;
  designation?: string;
  phone?: string;
  password?: string;
  securityPin?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  mustChangePassword?: boolean;
  isFirstLogin?: boolean;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export function sanitizeUser(u: any): any {
  if (!u) return null;
  const userCopy = { ...u };
  delete userCopy.password;
  if (userCopy.metadata) {
    const metaCopy = { ...userCopy.metadata };
    delete metaCopy.password;
    userCopy.metadata = metaCopy;
  }
  return userCopy;
}

function cleanUserData(data: any): UserEntity {
  const uid = data.uid || data.id || `user_${Date.now()}`;
  const username = (data.username || (data.email ? data.email.split('@')[0] : uid)).trim();
  const email = data.email ? data.email.trim().toLowerCase() : `${username.toLowerCase()}@stcs.local`;
  const meta = data.metadata || {};

  return {
    id: uid,
    uid,
    firebaseUid: data.firebaseUid || meta.firebaseUid || undefined,
    username,
    fullName: data.fullName || meta.fullName || username,
    email,
    role: data.role || 'GENERAL_USER',
    organizationId: data.organizationId || 'org_default',
    organizationName: data.organizationName || meta.organizationName || '',
    designation: data.designation || meta.designation || '',
    phone: data.phone || meta.phone || '',
    password: data.password || meta.password || undefined,
    securityPin: data.securityPin || meta.securityPin || '1234',
    securityQuestion: data.securityQuestion || meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
    securityAnswer: data.securityAnswer || meta.securityAnswer || 'नेपाल',
    mustChangePassword: data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : Boolean(meta.mustChangePassword),
    isFirstLogin: data.isFirstLogin !== undefined ? Boolean(data.isFirstLogin) : Boolean(meta.isFirstLogin),
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    metadata: {
      ...meta,
      password: data.password || meta.password || undefined,
      securityPin: data.securityPin || meta.securityPin || '1234',
      securityQuestion: data.securityQuestion || meta.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
      securityAnswer: data.securityAnswer || meta.securityAnswer || 'नेपाल',
      mustChangePassword: Boolean(data.mustChangePassword || meta.mustChangePassword),
      isFirstLogin: Boolean(data.isFirstLogin || meta.isFirstLogin),
    },
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveUser(data: any): Promise<UserEntity> {
  const user = cleanUserData(data);

  // 1. LocalStore persistence
  localSaveUser(user);

  // 2. Firebase Auth provisioning / update with Custom Claims (Task 8 & 11)
  try {
    let authUser: any = null;
    try {
      if (user.email) {
        authUser = await adminAuth.getUserByEmail(user.email);
      }
    } catch {
      // User not found in Firebase Auth yet
    }

    if (!authUser) {
      try {
        authUser = await adminAuth.createUser({
          uid: user.uid,
          email: user.email,
          password: user.password || 'admin123',
          displayName: user.fullName || user.username,
        });
      } catch (createErr: any) {
        // If UID exists or email exists with different UID
        if (createErr?.code === 'auth/uid-already-exists') {
          authUser = await adminAuth.getUser(user.uid);
        } else if (createErr?.code === 'auth/email-already-exists' && user.email) {
          authUser = await adminAuth.getUserByEmail(user.email);
        }
      }
    }

    if (authUser) {
      user.firebaseUid = authUser.uid;
      // Set Custom Claims for fast, secure RBAC
      await adminAuth.setCustomUserClaims(authUser.uid, {
        role: user.role,
        organizationId: user.organizationId,
      });

      if (user.password) {
        try {
          await adminAuth.updateUser(authUser.uid, {
            password: user.password,
            displayName: user.fullName || user.username,
          });
        } catch {}
      }
    }
  } catch (authErr: any) {
    console.warn('[UserRepo] Firebase Auth sync notice for user', user.username, ':', authErr?.message || authErr);
  }

  // 3. Best-effort Firestore write via adminDb
  try {
    const userToSave = sanitizeUser(user);
    const userRef = adminDb.collection('users').doc(user.uid);
    await userRef.set(userToSave, { merge: true });

    if (user.username) {
      const usernameRef = adminDb.collection('usernames').doc(user.username.toLowerCase());
      await usernameRef.set({
        uid: user.uid,
        authEmail: user.email,
        role: user.role,
        organizationId: user.organizationId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }, { merge: true });
    }

    // Write server-only credentials doc for verification fallback
    if (user.password) {
      await adminDb.collection('credentials').doc(user.uid).set({
        uid: user.uid,
        username: user.username,
        password: user.password,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err: any) {
    // Handled
  }

  // 4. Best-effort mirror to Cloud SQL
  if (await isSqlEnabled()) {
    try {
      await sqlGetOrCreateUser(
        user.uid,
        user.email,
        user.username,
        user.fullName,
        user.role,
        user.organizationId,
        user.metadata || user,
        user.firebaseUid
      );
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL mirror notice for user ${user.uid}:`, sqlErr?.message || sqlErr);
    }
  }

  return user;
}

export async function getUserByUid(uid: string): Promise<UserEntity | null> {
  if (!uid) return null;

  // 1. Firestore
  try {
    const docSnap = await adminDb.collection('users').doc(uid).get();
    if (docSnap.exists) {
      return cleanUserData(docSnap.data());
    }
  } catch (err: any) {
    // Fallback
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUid(uid);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. LocalStore
  const local = localGetUserByUid(uid);
  if (local) return cleanUserData(local);

  return null;
}

export async function getUserByUsername(username: string): Promise<UserEntity | null> {
  if (!username) return null;
  const clean = username.trim().toLowerCase();

  // 1. Firestore via usernames index
  try {
    const usernameDoc = await adminDb.collection('usernames').doc(clean).get();
    if (usernameDoc.exists) {
      const { uid } = usernameDoc.data() as any;
      if (uid) {
        const user = await getUserByUid(uid);
        if (user) return user;
      }
    }
    const snap = await adminDb.collection('users').where('username', '==', username.trim()).limit(1).get();
    if (!snap.empty) {
      return cleanUserData(snap.docs[0].data());
    }
  } catch (err: any) {
    // Fallback
  }

  // 2. SQL fallback
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUsernameOrEmailOrUid(username);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. LocalStore fallback
  const local = localGetUserByUsername(username);
  if (local) return cleanUserData(local);

  return null;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<UserEntity | null> {
  if (!firebaseUid) return null;

  // 1. Firestore
  try {
    const snap = await adminDb.collection('users').where('firebaseUid', '==', firebaseUid).limit(1).get();
    if (!snap.empty) {
      return cleanUserData(snap.docs[0].data());
    }
    const docSnap = await adminDb.collection('users').doc(firebaseUid).get();
    if (docSnap.exists) {
      return cleanUserData(docSnap.data());
    }
  } catch (err: any) {
    // Fallback
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByFirebaseUid(firebaseUid);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. LocalStore
  const all = localListUsers();
  const found = all.find((u) => u.firebaseUid === firebaseUid || u.uid === firebaseUid);
  if (found) return cleanUserData(found);

  return null;
}

export async function getUserByUsernameOrEmailOrUid(query: string): Promise<UserEntity | null> {
  if (!query) return null;
  const clean = query.trim();

  // Try username
  let user = await getUserByUsername(clean);
  if (user) return user;

  // Try UID
  user = await getUserByUid(clean);
  if (user) return user;

  // Try Firebase UID
  user = await getUserByFirebaseUid(clean);
  if (user) return user;

  // Try Firestore email query
  try {
    const snap = await adminDb.collection('users').where('email', '==', clean.toLowerCase()).limit(1).get();
    if (!snap.empty) {
      return cleanUserData(snap.docs[0].data());
    }
  } catch (err: any) {
    // Fallback
  }

  // SQL fallback
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUsernameOrEmailOrUid(clean);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  return null;
}

export async function listUsersByOrganization(orgId: string): Promise<UserEntity[]> {
  const usersMap = new Map<string, UserEntity>();

  // 1. Firestore
  try {
    let query: any = adminDb.collection('users');
    if (orgId && orgId !== 'all') {
      query = query.where('organizationId', '==', orgId);
    }
    const snap = await query.get();
    snap.forEach((doc: any) => {
      const u = cleanUserData(doc.data());
      usersMap.set(u.uid, u);
    });
  } catch (err: any) {
    // Fallback
  }

  // 2. SQL
  if (usersMap.size === 0 && (await isSqlEnabled())) {
    try {
      const sqlUsers =
        orgId && orgId !== 'all'
          ? await sqlGetUsersByOrganization(orgId)
          : await sqlGetUsers();
      for (const u of sqlUsers) {
        usersMap.set(u.uid, cleanUserData(u));
      }
    } catch (sqlErr: any) {
      // Fallback
    }
  }

  // 3. Merge with localStore
  const localUsers = localListUsers();
  for (const u of localUsers) {
    if ((!orgId || orgId === 'all' || u.organizationId === orgId) && !usersMap.has(u.uid)) {
      usersMap.set(u.uid, cleanUserData(u));
    }
  }

  return Array.from(usersMap.values());
}

export async function listAllUsers(): Promise<UserEntity[]> {
  return listUsersByOrganization('all');
}

export async function deleteUserByUid(uid: string): Promise<boolean> {
  if (!uid) return false;

  const existing = (await getUserByUid(uid)) || (await getUserByUsername(uid));
  localDeleteUser(uid);
  if (existing?.uid && existing.uid !== uid) {
    localDeleteUser(existing.uid);
  }

  // 1. Firestore
  try {
    await adminDb.collection('users').doc(uid).delete();
    if (existing?.uid && existing.uid !== uid) {
      await adminDb.collection('users').doc(existing.uid).delete();
    }
    if (existing?.username) {
      await adminDb.collection('usernames').doc(existing.username.toLowerCase()).delete();
    }
    await adminDb.collection('credentials').doc(uid).delete();
    if (existing?.uid) {
      await adminDb.collection('credentials').doc(existing.uid).delete();
    }

    // Legacy list cleanup
    try {
      const legacyRef = adminDb.collection('system_users').doc('registered_accounts');
      const snap = await legacyRef.get();
      if (snap.exists && Array.isArray(snap.data()?.users)) {
        const filtered = snap.data()?.users.filter((u: any) => u.id !== uid && u.uid !== uid && u.username !== uid);
        await legacyRef.set({ users: filtered, updatedAt: new Date().toISOString() });
      }
    } catch {}
  } catch (err: any) {
    console.warn(`[UserRepo] Notice deleting user ${uid} from Firestore:`, err?.message || err);
  }

  // 2. Firebase Auth deletion
  try {
    if (existing?.firebaseUid) {
      await adminAuth.deleteUser(existing.firebaseUid);
    } else if (existing?.uid) {
      await adminAuth.deleteUser(existing.uid);
    }
  } catch (authErr) {
    // Non-blocking if auth user doesn't exist
  }

  // 3. SQL deletion
  if (await isSqlEnabled()) {
    try {
      await sqlDeleteUserByUid(uid);
      if (existing?.uid && existing.uid !== uid) {
        await sqlDeleteUserByUid(existing.uid);
      }
    } catch (sqlErr: any) {
      // Handled
    }
  }

  return true;
}

export async function clearAllUsers(preserveSuperAdmin: boolean = true): Promise<boolean> {
  const allUsers = await listAllUsers();
  for (const u of allUsers) {
    if (preserveSuperAdmin && (u.role === 'SUPER_ADMIN' || u.username === 'superadmin' || u.username === 'rbthapamgr09')) {
      continue;
    }
    await deleteUserByUid(u.uid || u.id);
  }
  return true;
}

export async function linkFirebaseUid(uid: string, firebaseUid: string): Promise<void> {
  if (!uid || !firebaseUid) return;

  const local = localGetUserByUid(uid);
  if (local) {
    localSaveUser({ ...local, firebaseUid });
  }

  try {
    await adminDb.collection('users').doc(uid).set({ firebaseUid }, { merge: true });
  } catch (err: any) {
    // Handled
  }

  if (await isSqlEnabled()) {
    try {
      const user = await sqlGetUserByUid(uid);
      if (user) {
        await sqlLinkFirebaseUidToUser(user.id, firebaseUid);
      }
    } catch (sqlErr: any) {
      // Handled
    }
  }
}
