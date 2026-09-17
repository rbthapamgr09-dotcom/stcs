import crypto from 'crypto';
import { adminDb } from '../../lib/firebase-admin';
import { withFirestore } from '../repositories/firestoreGuard';

export interface PasswordRecord {
  algo: 'scrypt' | 'sha256' | 'plain';
  salt: string;
  hash: string;
  params?: {
    N?: number;
    r?: number;
    p?: number;
    maxmem?: number;
    keylen?: number;
  };
  mustChangePassword?: boolean;
  passwordUpdatedAt?: string;
  updatedAt?: string;
}

const DEFAULT_SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  keylen: 64,
};

/**
 * Hash plain text password using Node.js crypto.scrypt
 */
export async function hashPassword(plain: string): Promise<PasswordRecord> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      plain,
      salt,
      DEFAULT_SCRYPT_PARAMS.keylen,
      {
        N: DEFAULT_SCRYPT_PARAMS.N,
        r: DEFAULT_SCRYPT_PARAMS.r,
        p: DEFAULT_SCRYPT_PARAMS.p,
        maxmem: DEFAULT_SCRYPT_PARAMS.maxmem,
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });

  const now = new Date().toISOString();
  return {
    algo: 'scrypt',
    salt,
    hash: derivedKey.toString('hex'),
    params: DEFAULT_SCRYPT_PARAMS,
    mustChangePassword: false,
    passwordUpdatedAt: now,
    updatedAt: now,
  };
}

/**
 * Timing-safe password verification supporting scrypt, legacy sha256:salt:hash, and legacy plain
 */
export async function verifyPassword(
  plain: string,
  record: PasswordRecord | any
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!record || !plain) {
    return { valid: false, needsUpgrade: false };
  }

  // 1. Check if record is string or legacy format
  if (typeof record === 'string') {
    // Check if format is sha256:salt:hash
    if (record.startsWith('sha256:')) {
      const parts = record.split(':');
      if (parts.length === 3) {
        const [, salt, expectedHash] = parts;
        const testHash = crypto.createHash('sha256').update(`${salt}:${plain}`).digest('hex');
        const bufA = Buffer.from(testHash, 'hex');
        const bufB = Buffer.from(expectedHash, 'hex');
        const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
        return { valid, needsUpgrade: valid };
      }
    }
    // Plain text string
    const bufA = Buffer.from(plain, 'utf-8');
    const bufB = Buffer.from(record, 'utf-8');
    const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    return { valid, needsUpgrade: valid };
  }

  // 2. Scrypt algo
  if (record.algo === 'scrypt') {
    if (!record.salt || !record.hash) return { valid: false, needsUpgrade: false };
    const params = record.params || DEFAULT_SCRYPT_PARAMS;
    try {
      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(
          plain,
          record.salt,
          params.keylen || 64,
          {
            N: params.N || 16384,
            r: params.r || 8,
            p: params.p || 1,
            maxmem: params.maxmem || 32 * 1024 * 1024,
          },
          (err, key) => {
            if (err) reject(err);
            else resolve(key);
          }
        );
      });

      const bufA = derivedKey;
      const bufB = Buffer.from(record.hash, 'hex');
      const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
      return { valid, needsUpgrade: false };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // 3. Legacy sha256 in object format
  if (record.algo === 'sha256' || record.salt) {
    const salt = record.salt || '';
    const expectedHash = record.hash || '';
    const testHash = crypto.createHash('sha256').update(`${salt}:${plain}`).digest('hex');
    const bufA = Buffer.from(testHash, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    return { valid, needsUpgrade: valid };
  }

  // 4. Plain in object format
  if (record.plain || record.hash) {
    const target = record.plain || record.hash;
    const bufA = Buffer.from(plain, 'utf-8');
    const bufB = Buffer.from(target, 'utf-8');
    const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    return { valid, needsUpgrade: valid };
  }

  return { valid: false, needsUpgrade: false };
}

export interface UserCredentialEntity extends PasswordRecord {
  uid: string;
  usernameLower?: string;
}

/**
 * Retrieve credentials for a given user UID
 */
export async function getUserCredentials(uid: string): Promise<UserCredentialEntity | null> {
  if (!uid) return null;

  try {
    const snap = await withFirestore('getUserCredentials', async () => {
      return await adminDb.collection('user_credentials').doc(uid).get();
    }, { retries: 1, timeoutMs: 4000 });

    if (snap.exists) {
      const data = snap.data();
      return {
        uid,
        usernameLower: data.usernameLower || '',
        algo: data.algo || 'scrypt',
        salt: data.salt || '',
        hash: data.hash || '',
        params: data.params || DEFAULT_SCRYPT_PARAMS,
        mustChangePassword: Boolean(data.mustChangePassword),
        passwordUpdatedAt: data.passwordUpdatedAt || data.updatedAt,
        updatedAt: data.updatedAt,
      };
    }
  } catch (err: any) {
    console.warn(`[Credentials] Error reading user_credentials for ${uid}:`, err?.message || err);
  }

  // Fallback: check legacy credentials collection
  try {
    const legacySnap = await withFirestore('getLegacyCredentials', async () => {
      return await adminDb.collection('credentials').doc(uid).get();
    }, { retries: 1, timeoutMs: 3000 });

    if (legacySnap.exists) {
      const data = legacySnap.data();
      const rawPass = data.password || data.hash || '';
      return {
        uid,
        usernameLower: (data.username || '').toLowerCase(),
        algo: 'plain',
        salt: '',
        hash: rawPass,
        mustChangePassword: true,
        passwordUpdatedAt: data.updatedAt,
        updatedAt: data.updatedAt,
      };
    }
  } catch (legacyErr: any) {
    console.warn(`[Credentials] Error reading legacy credentials for ${uid}:`, legacyErr?.message || legacyErr);
  }

  return null;
}

/**
 * Save credentials for a given user UID
 */
export async function setUserCredentials(
  uid: string,
  recordOrUsername: (PasswordRecord & { usernameLower?: string }) | string,
  rawPassword?: string,
  mustChangePassword?: boolean
): Promise<void> {
  if (!uid) throw new Error('UID is required to set credentials');

  let record: PasswordRecord & { usernameLower?: string };

  if (typeof recordOrUsername === 'string') {
    const username = recordOrUsername;
    const plainPass = rawPassword || '';

    if (plainPass.startsWith('sha256:')) {
      const parts = plainPass.split(':');
      if (parts.length === 3) {
        record = {
          algo: 'sha256',
          salt: parts[1],
          hash: parts[2],
          usernameLower: username.toLowerCase(),
          mustChangePassword: mustChangePassword ?? false,
          passwordUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        const hashed = await hashPassword(plainPass);
        record = {
          ...hashed,
          usernameLower: username.toLowerCase(),
          mustChangePassword: mustChangePassword ?? false,
        };
      }
    } else if (plainPass.startsWith('scrypt:')) {
      const parts = plainPass.split(':');
      if (parts.length >= 3) {
        record = {
          algo: 'scrypt',
          salt: parts[1],
          hash: parts[2],
          usernameLower: username.toLowerCase(),
          mustChangePassword: mustChangePassword ?? false,
          passwordUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        const hashed = await hashPassword(plainPass);
        record = {
          ...hashed,
          usernameLower: username.toLowerCase(),
          mustChangePassword: mustChangePassword ?? false,
        };
      }
    } else {
      const hashed = await hashPassword(plainPass);
      record = {
        ...hashed,
        usernameLower: username.toLowerCase(),
        mustChangePassword: mustChangePassword ?? false,
      };
    }
  } else {
    record = recordOrUsername;
  }

  await withFirestore('setUserCredentials', async () => {
    const docRef = adminDb.collection('user_credentials').doc(uid);
    const now = new Date().toISOString();
    await docRef.set({
      uid,
      usernameLower: (record.usernameLower || '').toLowerCase(),
      algo: record.algo || 'scrypt',
      salt: record.salt || '',
      hash: record.hash || '',
      params: record.params || DEFAULT_SCRYPT_PARAMS,
      mustChangePassword: Boolean(record.mustChangePassword),
      passwordUpdatedAt: record.passwordUpdatedAt || now,
      updatedAt: now,
    }, { merge: true });
  }, { retries: 2, timeoutMs: 5000 });
}

/**
 * Delete credentials for a user
 */
export async function deleteUserCredentials(uid: string): Promise<void> {
  if (!uid) return;
  try {
    await adminDb.collection('user_credentials').doc(uid).delete().catch(() => {});
    await adminDb.collection('credentials').doc(uid).delete().catch(() => {});
  } catch (err) {
    console.warn(`[Credentials] Delete credentials warning for ${uid}:`, err);
  }
}

/**
 * Migrate legacy credentials to user_credentials
 */
export async function migrateLegacyCredentials(): Promise<{ count: number; migratedUids: string[] }> {
  const migratedUids: string[] = [];

  try {
    const legacySnaps = await adminDb.collection('credentials').get();
    for (const doc of legacySnaps.docs) {
      const data = doc.data();
      const uid = doc.id;
      const rawPassword = data.password || data.hash;
      if (rawPassword && typeof rawPassword === 'string') {
        const hashed = await hashPassword(rawPassword);
        await setUserCredentials(uid, {
          ...hashed,
          usernameLower: (data.username || '').toLowerCase(),
          mustChangePassword: false,
        });
        migratedUids.push(uid);
      }
    }
  } catch (err: any) {
    console.warn('[Credentials] Migration from legacy collection notice:', err?.message || err);
  }

  // Ensure default superadmin has valid credentials
  try {
    const superCred = await getUserCredentials('user_super_admin');
    if (!superCred) {
      const superHash = await hashPassword('admin123'); // initial seed only for superadmin bootstrap
      await setUserCredentials('user_super_admin', {
        ...superHash,
        usernameLower: 'superadmin',
        mustChangePassword: true,
      });
      migratedUids.push('user_super_admin');
    }
  } catch (superErr) {
    console.warn('[Credentials] Superadmin credential bootstrap notice:', superErr);
  }

  return { count: migratedUids.length, migratedUids };
}

