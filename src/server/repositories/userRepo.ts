import { adminDb, adminAuth } from '../../lib/firebase-admin.ts';
import { isSqlEnabled } from './sqlHelper.ts';
import { withFirestore, PersistenceError } from './firestoreGuard.ts';
import { assertUnderLimit } from '../utils/chunking.ts';
import {
  hashPassword,
  setUserCredentials,
  getUserCredentials,
  deleteUserCredentials,
} from '../auth/credentials.ts';
import {
  localSaveUser,
  localGetUserByUid,
  localGetUserByUsername,
  localListUsers,
  localDeleteUser,
} from './localStore.ts';
import {
  getUsers as sqlGetUsers,
  getUserById as sqlGetUserById,
  getUserByUid as sqlGetUserByUid,
  getUserByFirebaseUid as sqlGetUserByFirebaseUid,
  getUserByUsernameOrEmailOrUid as sqlGetUserByUsernameOrEmailOrUid,
  getUsersByOrganization as sqlGetUsersByOrganization,
  upsertUser as sqlUpsertUser,
  deleteUserByUid as sqlDeleteUserByUid,
  linkFirebaseUidToUser as sqlLinkFirebaseUidToUser,
} from '../../db/payroll.ts';

export interface UserEntity {
  id?: string;
  uid: string;
  username: string;
  usernameLower?: string;
  email: string;
  emailLower?: string;
  fullName: string;
  role: string;
  organizationId: string;
  organizationName?: string;
  isActive: boolean;
  phone?: string;
  panNumber?: string;
  designation?: string;
  password?: string;
  securityPin?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  mustChangePassword?: boolean;
  isFirstLogin?: boolean;
  permissions?: string[];
  searchKeywords?: string[];
  firebaseUid?: string;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export type UserSaveResult = {
  entity: UserEntity;
  persistedTo: string[];
} & UserEntity;

export function sanitizeUser(u: any): UserEntity {
  const sanitized = { ...u };
  delete sanitized.password;
  delete sanitized.salt;
  delete sanitized.hash;
  return sanitized;
}

export function buildSearchKeywords(user: any): string[] {
  const words = new Set<string>();
  const add = (str?: string) => {
    if (!str || typeof str !== 'string') return;
    const clean = str.trim().toLowerCase();
    if (!clean) return;
    words.add(clean);
    clean.split(/[\s,.-_@]+/).forEach((part) => {
      if (part.length > 1) words.add(part);
    });
  };

  add(user.username);
  add(user.fullName);
  add(user.email);
  add(user.designation);
  add(user.phone);
  add(user.panNumber);
  add(user.organizationName);

  return Array.from(words);
}

function cleanUserData(data: any): UserEntity {
  if (!data || typeof data !== 'object') {
    data = {};
  }
  const uid = data.uid || data.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const username = (data.username || (data.email ? data.email.split('@')[0] : `user_${Date.now()}`)).trim();
  const email = (data.email || `${username.toLowerCase()}@system.local`).trim();
  const usernameLower = username.toLowerCase();
  const emailLower = email.toLowerCase();

  const userObj: UserEntity = {
    id: String(data.id || uid),
    uid: String(uid),
    username,
    usernameLower,
    email,
    emailLower,
    fullName: data.fullName || data.name || username,
    role: data.role || 'GENERAL_USER',
    organizationId: data.organizationId || 'all',
    organizationName: data.organizationName || '',
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    phone: data.phone || '',
    panNumber: data.panNumber || '',
    designation: data.designation || '',
    password: data.password || undefined,
    securityPin: data.securityPin || '1234',
    securityQuestion: data.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
    securityAnswer: data.securityAnswer || 'नेपाल',
    mustChangePassword: data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : false,
    isFirstLogin: data.isFirstLogin !== undefined ? Boolean(data.isFirstLogin) : false,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    firebaseUid: data.firebaseUid || undefined,
    metadata: data.metadata || {},
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  userObj.searchKeywords = buildSearchKeywords(userObj);
  return userObj;
}

/**
 * Task 2: Atomic user provisioning via Firestore Transaction
 */
export async function provisionUserAtomic(params: {
  userData: any;
  password?: string;
  mustChangePassword?: boolean;
}): Promise<UserSaveResult> {
  const user = cleanUserData(params.userData);
  const username = (user.username || '').trim();
  const usernameLower = username.toLowerCase();
  if (!usernameLower) {
    const err: any = new Error('कृपया मान्य प्रयोगकर्ता नाम (Username) प्रविष्ट गर्नुहोस्।');
    err.code = 'INVALID_USERNAME';
    err.status = 400;
    throw err;
  }

  const rawPassword = params.password || params.userData.password;
  if (!rawPassword) {
    const err: any = new Error('पासवर्ड अनिवार्य छ।');
    err.code = 'PASSWORD_REQUIRED';
    err.status = 400;
    throw err;
  }

  const uid = user.uid || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  user.uid = uid;
  user.id = uid;
  user.username = username;
  user.usernameLower = usernameLower;
  user.emailLower = (user.email || '').toLowerCase().trim();
  user.searchKeywords = buildSearchKeywords(user);
  user.mustChangePassword = params.mustChangePassword ?? true;
  user.isFirstLogin = true;
  user.createdAt = user.createdAt || new Date().toISOString();
  user.updatedAt = new Date().toISOString();

  assertUnderLimit(user, 500_000, `प्रयोगकर्ता (${username})`);

  // Hash password using scrypt before entering transaction
  const credRecord = await hashPassword(rawPassword);

  // 1. Firestore Transaction (Atomic across usernames, users, user_credentials, office mirror)
  await withFirestore('provisionUserAtomic', async () => {
    await adminDb.runTransaction(async (transaction) => {
      const usernameRef = adminDb.collection('usernames').doc(usernameLower);
      const userRef = adminDb.collection('users').doc(uid);
      const credRef = adminDb.collection('user_credentials').doc(uid);

      // Check if username is already taken by another user
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists) {
        const existingData = usernameDoc.data();
        if (existingData?.uid && existingData.uid !== uid) {
          const err: any = new Error(`यो प्रयोगकर्ता नाम '${username}' पहिले नै दर्ता भइसकेको छ।`);
          err.code = 'USERNAME_TAKEN';
          err.status = 409;
          throw err;
        }
      }

      const userToSave = sanitizeUser(user);

      // 1. usernames/{usernameLower} index
      transaction.set(usernameRef, {
        uid,
        username,
        usernameLower,
        authEmail: user.email || `${usernameLower}@system.local`,
        role: user.role,
        organizationId: user.organizationId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }, { merge: true });

      // 2. users/{uid} profile
      transaction.set(userRef, userToSave, { merge: true });

      // 3. user_credentials/{uid}
      transaction.set(credRef, {
        uid,
        usernameLower,
        algo: credRecord.algo,
        salt: credRecord.salt,
        hash: credRecord.hash,
        params: credRecord.params,
        mustChangePassword: user.mustChangePassword,
        passwordUpdatedAt: new Date().toISOString(),
      }, { merge: true });

      // 4. offices/{organizationId}/users/{uid} mirror
      if (user.organizationId && user.organizationId !== 'all') {
        const officeUserRef = adminDb
          .collection('offices')
          .doc(user.organizationId)
          .collection('users')
          .doc(uid);
        transaction.set(officeUserRef, userToSave, { merge: true });
      }
    });
  });

  const persistedTo: string[] = ['firestore'];

  // 2. LocalStore cache
  try {
    localSaveUser(user);
    persistedTo.push('local');
  } catch (localErr: any) {
    console.warn(`[UserRepo] Local cache write notice for ${uid}:`, localErr?.message || localErr);
  }

  // 3. Cloud SQL mirror if enabled
  if (await isSqlEnabled()) {
    try {
      await sqlUpsertUser(user);
      persistedTo.push('sql');
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL mirror notice for ${uid}:`, sqlErr?.message || sqlErr);
    }
  }

  // 4. Firebase Auth provisioning (non-blocking)
  if (user.email && user.email.includes('@') && !user.email.endsWith('@example.com')) {
    try {
      let authUser: any = null;
      try {
        authUser = await adminAuth.getUserByEmail(user.email);
      } catch {}

      if (!authUser) {
        try {
          authUser = await adminAuth.createUser({
            uid,
            email: user.email,
            password: rawPassword,
            displayName: user.fullName || username,
          });
        } catch (createErr: any) {
          if (createErr?.code === 'auth/uid-already-exists') {
            authUser = await adminAuth.getUser(uid);
          } else if (createErr?.code === 'auth/email-already-exists' && user.email) {
            authUser = await adminAuth.getUserByEmail(user.email);
          }
        }
      }

      if (authUser) {
        user.firebaseUid = authUser.uid;
        await adminAuth.setCustomUserClaims(authUser.uid, {
          role: user.role,
          organizationId: user.organizationId,
        }).catch(() => {});
      }
    } catch (authErr) {
      console.warn('[UserRepo] Firebase Auth sync notice during provision:', authErr);
    }
  }

  return Object.assign({ entity: user, persistedTo }, user);
}

export async function saveUser(data: any): Promise<UserSaveResult> {
  const user = cleanUserData(data);
  assertUnderLimit(user, 500_000, `प्रयोगकर्ता (${user.username})`);

  // If password is provided, ensure user_credentials is populated with scrypt
  if (user.password) {
    try {
      await setUserCredentials(
        user.uid,
        user.username,
        user.password,
        user.mustChangePassword ?? false
      );
    } catch (credErr) {
      console.warn('[UserRepo] Error saving user credentials:', credErr);
    }
  }

  // 1. Firebase Auth provisioning / update with Custom Claims
  try {
    let authUser: any = null;
    if (user.email && user.email.includes('@') && !user.email.endsWith('@example.com')) {
      try {
        authUser = await adminAuth.getUserByEmail(user.email);
      } catch {
        // Not found in Auth yet
      }

      if (!authUser) {
        try {
          authUser = await adminAuth.createUser({
            uid: user.uid,
            email: user.email,
            password: user.password || `Temp@${Math.random().toString(36).substring(2, 10)}!`,
            displayName: user.fullName || user.username,
          });
        } catch (createErr: any) {
          if (createErr?.code === 'auth/uid-already-exists') {
            authUser = await adminAuth.getUser(user.uid);
          } else if (createErr?.code === 'auth/email-already-exists' && user.email) {
            authUser = await adminAuth.getUserByEmail(user.email);
          }
        }
      }

      if (authUser) {
        user.firebaseUid = authUser.uid;
        try {
          await adminAuth.setCustomUserClaims(authUser.uid, {
            role: user.role,
            organizationId: user.organizationId,
          });
        } catch (claimsErr) {
          console.warn('[UserRepo] Notice setting claims for user:', claimsErr);
        }

        if (user.password) {
          try {
            await adminAuth.updateUser(authUser.uid, {
              password: user.password,
              displayName: user.fullName || user.username,
            });
          } catch (updateErr) {
            console.warn('[UserRepo] Notice updating auth password:', updateErr);
          }
        }
      }
    }
  } catch (authErr: any) {
    console.warn('[UserRepo] Firebase Auth sync notice for user', user.username, ':', authErr?.message || authErr);
  }

  const persistedTo: string[] = [];

  // 2. Primary Firestore write via adminDb with withFirestore
  await withFirestore('saveUser', async () => {
    const userToSave = sanitizeUser(user);
    const userRef = adminDb.collection('users').doc(user.uid);
    await userRef.set(userToSave, { merge: true });

    if (user.username) {
      const usernameRef = adminDb.collection('usernames').doc(user.username.toLowerCase());
      await usernameRef.set({
        uid: user.uid,
        username: user.username,
        usernameLower: user.username.toLowerCase(),
        authEmail: user.email,
        role: user.role,
        organizationId: user.organizationId,
        isActive: user.isActive,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // Keep office subcollection synced if organization is specific
    if (user.organizationId && user.organizationId !== 'all') {
      const officeUserRef = adminDb
        .collection('offices')
        .doc(user.organizationId)
        .collection('users')
        .doc(user.uid);
      await officeUserRef.set(userToSave, { merge: true });
    }
  });
  persistedTo.push('firestore');

  // 3. Local cache persistence (ONLY after Firestore confirms)
  try {
    localSaveUser(user);
    persistedTo.push('local');
  } catch (localErr: any) {
    console.warn(`[UserRepo] Local cache write notice for user ${user.uid}:`, localErr?.message || localErr);
  }

  // 4. Mirror to Cloud SQL if enabled
  if (await isSqlEnabled()) {
    try {
      await sqlUpsertUser(user);
      persistedTo.push('sql');
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL mirror notice for user ${user.uid}:`, sqlErr?.message || sqlErr);
    }
  }

  return Object.assign({ entity: user, persistedTo }, user);
}

export async function getUserByUid(uid: string): Promise<UserEntity | null> {
  if (!uid) return null;

  // 1. Firestore
  try {
    const docSnap = await withFirestore('getUserByUid', async () => {
      return await adminDb.collection('users').doc(uid).get();
    }, { retries: 1, timeoutMs: 5000 });

    if (docSnap.exists) {
      return cleanUserData(docSnap.data());
    }
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore read error for user ${uid}:`, err?.message || err);
  }

  // 2. SQL
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUid(uid);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL read error for user ${uid}:`, sqlErr?.message || sqlErr);
    }
  }

  // 3. LocalStore
  const local = localGetUserByUid(uid);
  if (local) return cleanUserData(local);

  return null;
}

export async function getUserByUsername(username: string): Promise<UserEntity | null> {
  if (!username) return null;
  const qLower = username.toLowerCase().trim();

  // 1. O(1) usernames index
  try {
    const docSnap = await withFirestore('getUserByUsernameIndex', async () => {
      return await adminDb.collection('usernames').doc(qLower).get();
    }, { retries: 1, timeoutMs: 5000 });

    if (docSnap.exists) {
      const uData = docSnap.data();
      if (uData?.uid) {
        const fullUser = await getUserByUid(uData.uid);
        if (fullUser) return fullUser;
      }
    }

    // 2. Query users collection by usernameLower
    const usernameLowerSnap = await adminDb.collection('users')
      .where('usernameLower', '==', qLower)
      .limit(1)
      .get();
    if (!usernameLowerSnap.empty) {
      return cleanUserData(usernameLowerSnap.docs[0].data());
    }

    // 2b. Query users collection by legacy username
    const usernameSnap = await adminDb.collection('users')
      .where('username', '==', username.trim())
      .limit(1)
      .get();
    if (!usernameSnap.empty) {
      return cleanUserData(usernameSnap.docs[0].data());
    }

    // 3. Query users collection by emailLower
    const emailLowerSnap = await adminDb.collection('users')
      .where('emailLower', '==', qLower)
      .limit(1)
      .get();
    if (!emailLowerSnap.empty) {
      return cleanUserData(emailLowerSnap.docs[0].data());
    }

    const emailSnap = await adminDb.collection('users')
      .where('email', '==', username.trim())
      .limit(1)
      .get();
    if (!emailSnap.empty) {
      return cleanUserData(emailSnap.docs[0].data());
    }
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore read error for username ${username}:`, err?.message || err);
  }

  // 4. SQL fallback
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUsernameOrEmailOrUid(username);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL read error for username ${username}:`, sqlErr?.message || sqlErr);
    }
  }

  // 5. LocalStore fallback
  const local = localGetUserByUsername(username);
  if (local) return cleanUserData(local);

  // 6. Full list scan fallback
  try {
    const allUsers = await listAllUsers();
    const found = allUsers.find(
      (u) =>
        u.username?.toLowerCase() === qLower ||
        u.email?.toLowerCase() === qLower ||
        u.uid === username.trim()
    );
    if (found) return cleanUserData(found);
  } catch {}

  return null;
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<UserEntity | null> {
  if (!firebaseUid) return null;

  // 1. Firestore
  try {
    const snap = await withFirestore('getUserByFirebaseUid', async () => {
      return await adminDb.collection('users').where('firebaseUid', '==', firebaseUid).limit(1).get();
    }, { retries: 1, timeoutMs: 5000 });

    if (!snap.empty) {
      return cleanUserData(snap.docs[0].data());
    }
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

  // 3. LocalStore
  const all = localListUsers();
  const found = all.find((u: any) => u.firebaseUid === firebaseUid || u.uid === firebaseUid);
  if (found) return cleanUserData(found);

  return null;
}

export async function getUserByUsernameOrEmailOrUid(identifier: string): Promise<UserEntity | null> {
  if (!identifier) return null;
  const clean = identifier.trim();

  const byUid = await getUserByUid(clean);
  if (byUid) return byUid;

  const byUser = await getUserByUsername(clean);
  if (byUser) return byUser;

  const byFb = await getUserByFirebaseUid(clean);
  if (byFb) return byFb;

  // Email lookup
  try {
    const snap = await adminDb.collection('users').where('email', '==', clean.toLowerCase()).limit(1).get();
    if (!snap.empty) {
      return cleanUserData(snap.docs[0].data());
    }
  } catch (err: any) {
    console.warn(`[UserRepo] Firestore email lookup error for ${clean}:`, err?.message || err);
  }

  // SQL fallback
  if (await isSqlEnabled()) {
    try {
      const sqlUser = await sqlGetUserByUsernameOrEmailOrUid(clean);
      if (sqlUser) return cleanUserData(sqlUser);
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL email lookup error for ${clean}:`, sqlErr?.message || sqlErr);
    }
  }

  return null;
}

export async function listUsersByOrganization(orgId: string = 'all'): Promise<UserEntity[]> {
  const usersMap = new Map<string, UserEntity>();

  // 1. Firestore query
  try {
    const query = orgId && orgId !== 'all'
      ? adminDb.collection('users').where('organizationId', 'in', [orgId, 'all'])
      : adminDb.collection('users');

    const snap = await withFirestore('listUsers', async () => {
      return await query.get();
    }, { retries: 1, timeoutMs: 6000 });

    snap.forEach((doc: any) => {
      const u = cleanUserData(doc.data());
      usersMap.set(u.uid, u);
    });
  } catch (err: any) {
    console.warn('[UserRepo] Firestore listUsers notice:', err?.message || err);
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
      console.warn('[UserRepo] SQL listUsers notice:', sqlErr?.message || sqlErr);
    }
  }

  // 3. Merge with localStore
  const localList = localListUsers();
  for (const u of localList) {
    if (orgId === 'all' || u.organizationId === orgId || u.organizationId === 'all') {
      if (!usersMap.has(u.uid)) {
        usersMap.set(u.uid, cleanUserData(u));
      }
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

  const uidsToDelete = new Set<string>([uid]);
  if (existing?.uid) uidsToDelete.add(existing.uid);
  if (existing?.id) uidsToDelete.add(String(existing.id));
  if (existing?.username) {
    uidsToDelete.add(existing.username);
    uidsToDelete.add(`user_${existing.username.toLowerCase()}`);
  }

  // 1. Primary Firestore Deletions with withFirestore
  await withFirestore('deleteUser', async () => {
    const batch = adminDb.batch();

    for (const id of uidsToDelete) {
      batch.delete(adminDb.collection('users').doc(id));
      batch.delete(adminDb.collection('user_credentials').doc(id));
      batch.delete(adminDb.collection('credentials').doc(id));
    }

    if (existing?.username) {
      batch.delete(adminDb.collection('usernames').doc(existing.username.toLowerCase()));
    }
    batch.delete(adminDb.collection('usernames').doc(uid.toLowerCase()));

    await batch.commit();

    // Query-based deletion from users collection
    const qSnaps = await adminDb.collection('users')
      .where('username', '==', existing?.username || uid)
      .get();
    if (!qSnaps.empty) {
      const qBatch = adminDb.batch();
      qSnaps.forEach((doc) => qBatch.delete(doc.ref));
      await qBatch.commit();
    }

    // Office subcollections
    if (existing?.organizationId && existing.organizationId !== 'all') {
      for (const id of uidsToDelete) {
        await adminDb
          .collection('offices')
          .doc(existing.organizationId)
          .collection('users')
          .doc(id)
          .delete()
          .catch(() => {});
      }
    }

    // Legacy list cleanup
    const legacyRef = adminDb.collection('system_users').doc('registered_accounts');
    const snap = await legacyRef.get();
    if (snap.exists && Array.isArray(snap.data()?.users)) {
      const filtered = snap.data()?.users.filter((u: any) => {
        const uName = u.username?.toLowerCase();
        const targetName = existing?.username?.toLowerCase() || uid.toLowerCase();
        return !uidsToDelete.has(u.id) && !uidsToDelete.has(u.uid) && uName !== targetName;
      });
      await legacyRef.set({ users: filtered, updatedAt: new Date().toISOString() });
    }
  });

  // 2. Delete from localStore cache ONLY after Firestore succeeds
  localDeleteUser(uid);
  if (existing?.uid && existing.uid !== uid) {
    localDeleteUser(existing.uid);
  }
  if (existing?.username) {
    localDeleteUser(existing.username);
  }

  // 3. Firebase Auth deletion
  try {
    if (existing?.firebaseUid) {
      await adminAuth.deleteUser(existing.firebaseUid);
    } else if (existing?.uid) {
      await adminAuth.deleteUser(existing.uid);
    }
  } catch (authErr) {
    // Non-blocking if auth user doesn't exist
  }

  // 4. SQL deletion
  if (await isSqlEnabled()) {
    try {
      for (const id of uidsToDelete) {
        await sqlDeleteUserByUid(id);
      }
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL delete user notice for ${uid}:`, sqlErr?.message || sqlErr);
    }
  }

  return true;
}

export async function clearAllUsers(preserveSuperAdmin: boolean = true): Promise<boolean> {
  // 1. Primary Firestore clear with withFirestore
  await withFirestore('clearAllUsers', async () => {
    const snaps = await adminDb.collection('users').get();
    const batch = adminDb.batch();

    snaps.forEach((doc) => {
      const data = doc.data();
      if (preserveSuperAdmin && (data.role === 'super_admin' || data.username === 'admin' || data.username === 'superadmin')) {
        return;
      }
      batch.delete(doc.ref);
    });

    await batch.commit();

    const legacyRef = adminDb.collection('system_users').doc('registered_accounts');
    await legacyRef.delete().catch(() => {});
  });

  // 2. Clear local cache
  const localList = localListUsers();
  for (const u of localList) {
    if (preserveSuperAdmin && (u.role === 'super_admin' || u.username === 'admin')) continue;
    localDeleteUser(u.uid);
  }

  return true;
}

export async function linkFirebaseUid(uid: string, firebaseUid: string): Promise<void> {
  if (!uid || !firebaseUid) return;

  await withFirestore('linkFirebaseUid', async () => {
    await adminDb.collection('users').doc(uid).set({ firebaseUid }, { merge: true });
  });

  const local = localGetUserByUid(uid);
  if (local) {
    localSaveUser({ ...local, firebaseUid });
  }

  if (await isSqlEnabled()) {
    try {
      const user = await sqlGetUserByUid(uid);
      if (user) {
        await sqlLinkFirebaseUidToUser(user.uid, firebaseUid);
      }
    } catch (sqlErr: any) {
      console.warn(`[UserRepo] SQL link Firebase UID notice:`, sqlErr?.message || sqlErr);
    }
  }
}

/**
 * Task 5: Re-indexes all users into usernames/{usernameLower} and reports credential health
 */
export async function reindexAllUsernames(): Promise<{
  totalUsers: number;
  indexedCount: number;
  usersWithoutCredentials: string[];
}> {
  const usersSnap = await adminDb.collection('users').get();
  let indexedCount = 0;
  const usersWithoutCredentials: string[] = [];

  const batch = adminDb.batch();

  for (const doc of usersSnap.docs) {
    const u = doc.data();
    const username = (u.username || '').trim();
    if (!username) continue;
    const usernameLower = username.toLowerCase();
    const uid = doc.id;

    // Index document
    const indexRef = adminDb.collection('usernames').doc(usernameLower);
    batch.set(indexRef, {
      uid,
      username,
      usernameLower,
      authEmail: u.email || `${usernameLower}@system.local`,
      role: u.role || 'GENERAL_USER',
      organizationId: u.organizationId || 'all',
      isActive: u.isActive !== false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    indexedCount++;

    // Check credentials record
    const credSnap = await adminDb.collection('user_credentials').doc(uid).get();
    if (!credSnap.exists) {
      // Check legacy credentials
      const legSnap = await adminDb.collection('credentials').doc(uid).get();
      if (!legSnap.exists && !u.password && !u.metadata?.password) {
        usersWithoutCredentials.push(`${username} (${uid})`);
      }
    }
  }

  if (indexedCount > 0) {
    await batch.commit();
  }

  return {
    totalUsers: usersSnap.size,
    indexedCount,
    usersWithoutCredentials,
  };
}
