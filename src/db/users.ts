import { db, withDbRetry } from './index.ts';
import { users } from './schema.ts';
import { desc, eq, or, sql } from 'drizzle-orm';

export async function getOrCreateUser(
  uid: string,
  email: string,
  username?: string,
  fullName?: string,
  role?: string,
  organizationId?: string,
  metadata?: Record<string, any>,
  firebaseUid?: string
) {
  try {
    const cleanUsername = (username || email.split('@')[0] || uid).trim();
    const cleanFullName = (fullName || cleanUsername || 'User').trim();
    const cleanRole = role || 'GENERAL_USER';
    const cleanOrgId = organizationId || 'org_default';
    const cleanOrgName = (metadata as any)?.organizationName || null;
    const cleanDesignation = (metadata as any)?.designation || null;
    const cleanPhone = (metadata as any)?.phone || null;
    const cleanIsActive = (metadata as any)?.isActive !== undefined ? Boolean((metadata as any).isActive) : true;
    const cleanEmail = email ? email.trim().toLowerCase() : `${cleanUsername.toLowerCase()}@system.local`;
    const cleanFirebaseUid = firebaseUid || (metadata as any)?.firebaseUid || null;

    // 1. Check if user already exists by uid, firebaseUid OR matching username
    const conditions = [
      eq(users.uid, uid),
      sql`lower(${users.username}) = ${cleanUsername.toLowerCase()}`,
    ];
    if (cleanFirebaseUid) {
      conditions.push(eq(users.firebaseUid, cleanFirebaseUid));
    }

    const existing = await withDbRetry(() =>
      db
        .select()
        .from(users)
        .where(or(...conditions))
        .limit(1)
    );

    if (existing && existing.length > 0) {
      const existingUser = existing[0];
      const mergedMeta = {
        ...((existingUser.metadata as Record<string, any>) || {}),
        ...(metadata || {}),
      };

      const updated = await withDbRetry(() =>
        db
          .update(users)
          .set({
            uid: uid || existingUser.uid,
            firebaseUid: cleanFirebaseUid || existingUser.firebaseUid,
            username: cleanUsername,
            email: cleanEmail || existingUser.email,
            fullName: cleanFullName,
            role: cleanRole,
            organizationId: cleanOrgId,
            organizationName: cleanOrgName || existingUser.organizationName,
            designation: cleanDesignation || existingUser.designation,
            phone: cleanPhone || existingUser.phone,
            isActive: cleanIsActive,
            metadata: mergedMeta,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning()
      );
      return updated[0];
    } else {
      // 2. Insert new user record safely with onConflict handling
      const inserted = await withDbRetry(() =>
        db
          .insert(users)
          .values({
            uid,
            firebaseUid: cleanFirebaseUid,
            email: cleanEmail,
            username: cleanUsername,
            fullName: cleanFullName,
            role: cleanRole,
            organizationId: cleanOrgId,
            organizationName: cleanOrgName,
            designation: cleanDesignation,
            phone: cleanPhone,
            isActive: cleanIsActive,
            metadata: metadata || {},
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              firebaseUid: cleanFirebaseUid,
              username: cleanUsername,
              email: cleanEmail,
              fullName: cleanFullName,
              role: cleanRole,
              organizationId: cleanOrgId,
              organizationName: cleanOrgName,
              designation: cleanDesignation,
              phone: cleanPhone,
              isActive: cleanIsActive,
              metadata: metadata || {},
              updatedAt: new Date(),
            },
          })
          .returning()
      );
      return inserted[0];
    }
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database user sync failed. Please try again later.', { cause: error });
  }
}

export async function upsertUsersBatch(usersList: Array<{
  uid: string;
  email?: string;
  username: string;
  fullName?: string;
  role?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}>) {
  const results = [];
  for (const u of usersList) {
    if (!u.uid && !u.username) continue;
    const targetUid = u.uid || u.username;
    const targetEmail = u.email || `${u.username}@system.local`;
    const res = await getOrCreateUser(
      targetUid,
      targetEmail,
      u.username,
      u.fullName,
      u.role,
      u.organizationId,
      u.metadata
    );
    results.push(res);
  }
  return results;
}

export async function getUsers() {
  try {
    return await withDbRetry(() => db.select().from(users).orderBy(desc(users.updatedAt)));
  } catch (error) {
    console.error('Database query failed in getUsers:', error);
    throw new Error('Failed to retrieve users from database.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const result = await withDbRetry(() => db.select().from(users).where(eq(users.uid, uid)));
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user from database.', { cause: error });
  }
}

export async function getUserByFirebaseUid(firebaseUid: string) {
  try {
    if (!firebaseUid) return null;
    const result = await withDbRetry(() =>
      db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1)
    );
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByFirebaseUid:', error);
    return null;
  }
}

export async function linkFirebaseUidToUser(userId: number, firebaseUid: string) {
  try {
    if (!userId || !firebaseUid) return null;
    const updated = await withDbRetry(() =>
      db
        .update(users)
        .set({
          firebaseUid,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning()
    );
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in linkFirebaseUidToUser:', error);
    return null;
  }
}

export async function getUserByUsernameOrEmailOrUid(identifier: string) {
  try {
    const lower = identifier.trim().toLowerCase();
    const cleanId = identifier.trim();
    const result = await withDbRetry(() =>
      db
        .select()
        .from(users)
        .where(
          or(
            sql`lower(${users.username}) = ${lower}`,
            sql`lower(${users.email}) = ${lower}`,
            eq(users.uid, cleanId),
            eq(users.firebaseUid, cleanId)
          )
        )
        .orderBy(desc(users.updatedAt))
        .limit(1)
    );
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUsernameOrEmailOrUid:', error);
    return null;
  }
}

export async function deleteUserByUid(uid: string) {
  try {
    const result = await withDbRetry(() =>
      db
        .delete(users)
        .where(
          or(
            eq(users.uid, uid),
            eq(users.username, uid),
            eq(users.email, uid)
          )
        )
        .returning()
    );
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in deleteUserByUid:', error);
    throw new Error('Failed to delete user from database.', { cause: error });
  }
}

export async function getUsersByOrganization(orgId: string) {
  try {
    const targetOrgId = orgId || 'org_default';
    return await withDbRetry(() =>
      db
        .select()
        .from(users)
        .where(
          or(
            eq(users.organizationId, targetOrgId),
            // Include global superadmins if querying
            targetOrgId === 'org_default' ? sql`${users.organizationId} IS NULL` : sql`false`
          )
        )
        .orderBy(desc(users.updatedAt))
    );
  } catch (error) {
    console.error(`Database query failed in getUsersByOrganization for ${orgId}:`, error);
    return [];
  }
}


