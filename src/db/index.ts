import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: ReturnType<typeof drizzle> | undefined;
}

export const resetPool = async () => {
  const oldPool = global._postgresPool;
  global._postgresPool = undefined;
  global._drizzleDb = undefined;
  if (oldPool) {
    try {
      await oldPool.end();
    } catch {
      // ignore
    }
  }
};

// Function to create or retrieve the connection pool using resilient settings.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || '127.0.0.1',
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DB_NAME || 'postgres',
      max: 10,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.warn('SQL pool connection notice (fallback/idle):', err.message);
      if (
        err.message?.includes('Connection terminated') ||
        (err as any)?.code === 'ECONNRESET' ||
        (err as any)?.code === '57P01'
      ) {
        resetPool();
      }
    });
  }
  return global._postgresPool;
};

export const getDb = () => {
  if (!global._drizzleDb) {
    const pool = createPool();
    global._drizzleDb = drizzle(pool, { schema });
  }
  return global._drizzleDb;
};

// Export db proxy for backwards compatibility
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const database = getDb();
    return (database as any)[prop];
  },
});

export async function withDbRetry<T>(queryFn: () => Promise<T>, maxRetries = 2, delayMs = 600): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await queryFn();
    } catch (error: any) {
      attempt++;
      const isTransient =
        error?.message?.includes('Connection terminated') ||
        error?.message?.includes('connection timeout') ||
        error?.message?.includes('timeout') ||
        error?.code === 'ECONNRESET' ||
        error?.code === '57P01' ||
        error?.cause?.message?.includes('Connection terminated') ||
        error?.cause?.message?.includes('timeout');

      if (isTransient && attempt <= maxRetries) {
        console.warn(
          `[Cloud SQL] Transient connection issue (attempt ${attempt}/${maxRetries}), refreshing pool and retrying in ${delayMs}ms:`,
          error?.message || error
        );
        await resetPool();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}

