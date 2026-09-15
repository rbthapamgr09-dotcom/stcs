import { adminDb } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
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
  let firestoreSaved = false;

  // 1. Write to Firestore via adminDb
  try {
    const userRef = adminDb.collection('users').doc(user.uid);
    await userRef.set(user, { merge: true });

    // Also update username index
    if (user.username) {
      const usernameRef = adminDb.collection('usernames').doc(user.username.toLowerCase());
      await usernameRef.set({
        uid: user.uid,
        authEmail: user.email,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
      }, { merge: true });
    }
    firestoreSaved = true;
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore write error for user ${user.uid}:`, err?.message || err);
  }

  // 2. Mirror to SQL
  if (await isSqlEnabled()) {
    try {
      await sqlGetOrCreateUser(
        user.uid,
        user.email,
        user.username,
        user.fullName,
        user.role,
        user.organizationId,
        user.metadata,
        user.firebaseUid
      );
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL mirror error for user ${user.uid}:`, sqlErr?.message || sqlErr);
      if (!firestoreSaved) {
        throw new Error(`Failed to persist user to both Firestore and SQL: ${sqlErr.message}`);
      }
    }
  } else if (!firestoreSaved) {
    throw new Error('Could not persist user: Firestore is unavailable and SQL is disabled.');
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
    console.warn(`[UserRepo] Firestore read error for uid ${uid}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUid(uid);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL read error for uid ${uid}:`, sqlErr?.message || sqlErr);
    }
  }

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
    // Direct query fallback on users collection
    const snap = await adminDb.collection('users').where('username', '==', username.trim()).limit(1).get();
    if (!snap.empty) {
      return cleanUserData(snap.docs[0].data());
    }
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore username read error for ${clean}:`, err?.message || err);
  }

  // 2. SQL fallback
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUsernameOrEmailOrUid(username);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL username lookup error for ${clean}:`, sqlErr?.message || sqlErr);
    }
  }

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
    // Also check if document ID is firebaseUid
    const docSnap = await adminDb.collection('users').doc(firebaseUid).get();
    if (docSnap.exists) {
      return cleanUserData(docSnap.data());
    }
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore read error for firebaseUid ${firebaseUid}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByFirebaseUid(firebaseUid);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL read error for firebaseUid ${firebaseUid}:`, sqlErr?.message || sqlErr);
    }
  }

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
    console.warn('[UserRepo] Firestore email query error:', err?.message || err);
  }

  // SQL fallback
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUsernameOrEmailOrUid(clean);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn('[UserRepo] SQL lookup error:', sqlErr?.message || sqlErr);
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
    console.warn(`[UserRepo] Firestore list error for org ${orgId}:`, err?.message || err);
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
      console.warn(`[UserRepo] SQL list error for org ${orgId}:`, sqlErr?.message || sqlErr);
    }
  }

  return Array.from(usersMap.values());
}

export async function listAllUsers(): Promise<UserEntity[]> {
  return listUsersByOrganization('all');
}

export async function deleteUserByUid(uid: string): Promise<boolean> {
  if (!uid) return false;

  const existing = await getUserByUid(uid);

  // Firestore
  try {
    await adminDb.collection('users').doc(uid).delete();
    if (existing?.username) {
      await adminDb.collection('usernames').doc(existing.username.toLowerCase()).delete();
    }
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore delete error for uid ${uid}:`, err?.message || err);
  }

  // SQL
  if (await isSqlEnabled()) {
    try {
      await sqlDeleteUserByUid(uid);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL delete error for uid ${uid}:`, sqlErr?.message || sqlErr);
    }
  }

  return true;
}

export async function linkFirebaseUid(uid: string, firebaseUid: string): Promise<void> {
  if (!uid || !firebaseUid) return;

  try {
    await adminDb.collection('users').doc(uid).set({ firebaseUid }, { merge: true });
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore linkFirebaseUid error:`, err?.message || err);
  }

  if (await isSqlEnabled()) {
    try {
      const user = await sqlGetUserByUid(uid);
      if (user) {
        await sqlLinkFirebaseUidToUser(user.id, firebaseUid);
      }
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL linkFirebaseUid error:`, sqlErr?.message || sqlErr);
    }
  }
}
