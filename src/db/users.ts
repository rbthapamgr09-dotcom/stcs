import { db, withDbRetry } from './index.ts';
import { users } from './schema.ts';
import { eq, or, sql } from 'drizzle-orm';

export async function getOrCreateUser(
  uid: string,
  email: string,
  username?: string,
  fullName?: string,
  role?: string,
  organizationId?: string,
  metadata?: Record<string, any>
) {
  try {
    const cleanUsername = username || email.split('@')[0] || uid;
    const cleanFullName = fullName || cleanUsername || 'User';
    const cleanRole = role || 'GENERAL_USER';
    const cleanOrgId = organizationId || 'org_default';
    const cleanOrgName = (metadata as any)?.organizationName || null;
    const cleanDesignation = (metadata as any)?.designation || null;
    const cleanPhone = (metadata as any)?.phone || null;
    const cleanIsActive = (metadata as any)?.isActive !== undefined ? Boolean((metadata as any).isActive) : true;

    const result = await withDbRetry(() =>
      db
        .insert(users)
        .values({
          uid,
          email,
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
            username: cleanUsername,
            email,
            fullName: cleanFullName,
            role: cleanRole,
            organizationId: cleanOrgId,
            organizationName: cleanOrgName || undefined,
            designation: cleanDesignation || undefined,
            phone: cleanPhone || undefined,
            isActive: cleanIsActive,
            metadata: metadata || {},
            updatedAt: new Date(),
          },
        })
        .returning()
    );

    return result[0];
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
    return await withDbRetry(() => db.select().from(users));
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

export async function getUserByUsernameOrEmailOrUid(identifier: string) {
  try {
    const lower = identifier.trim().toLowerCase();
    const result = await withDbRetry(() =>
      db
        .select()
        .from(users)
        .where(
          or(
            sql`lower(${users.username}) = ${lower}`,
            sql`lower(${users.email}) = ${lower}`,
            eq(users.uid, identifier.trim())
          )
        )
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
      db.delete(users).where(eq(users.uid, uid)).returning()
    );
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in deleteUserByUid:', error);
    throw new Error('Failed to delete user from database.', { cause: error });
  }
}

