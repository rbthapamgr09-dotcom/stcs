import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

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
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        username: username || email.split('@')[0] || uid,
        fullName: fullName || username || email.split('@')[0] || 'User',
        role: role || 'GENERAL_USER',
        organizationId: organizationId || 'org_default',
        metadata: metadata || {},
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          fullName: fullName || undefined,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database user sync failed. Please try again later.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed in getUsers:', error);
    throw new Error('Failed to retrieve users from database.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid));
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user from database.', { cause: error });
  }
}

export async function deleteUserByUid(uid: string) {
  try {
    const result = await db.delete(users).where(eq(users.uid, uid)).returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in deleteUserByUid:', error);
    throw new Error('Failed to delete user from database.', { cause: error });
  }
}
