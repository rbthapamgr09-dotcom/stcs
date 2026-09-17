import { adminDb, getFirestoreDatabaseId } from '../../lib/firebase-admin.ts';
import fs from 'fs';
import path from 'path';

/**
 * Firestore Guard with retries, timeouts, and typed PersistenceError
 */

export class PersistenceError extends Error {
  code: string;
  layer: 'firestore' | 'sql' | 'local';
  cause?: any;

  constructor(opts: { code: string; layer: 'firestore' | 'sql' | 'local'; message: string; cause?: any }) {
    super(opts.message);
    this.name = 'PersistenceError';
    this.code = opts.code;
    this.layer = opts.layer;
    this.cause = opts.cause;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PersistenceError);
    }
  }
}

const RETRIABLE_CODES = new Set([
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
  'ABORTED',
  'INTERNAL',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNABORTED',
  // gRPC status code numbers
  14, // UNAVAILABLE
  4,  // DEADLINE_EXCEEDED
  10, // ABORTED
  13, // INTERNAL
]);

function isRetriableError(err: any): boolean {
  if (!err) return false;
  if (err.code && RETRIABLE_CODES.has(err.code)) return true;
  if (typeof err.code === 'number' && RETRIABLE_CODES.has(err.code)) return true;
  
  const msg = (err.message || String(err)).toUpperCase();
  return (
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('ABORTED') ||
    msg.includes('INTERNAL') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('TIMEOUT')
  );
}

function extractErrorCode(err: any): string {
  if (!err) return 'UNKNOWN_ERROR';
  if (typeof err.code === 'string') return err.code;
  if (typeof err.code === 'number') {
    switch (err.code) {
      case 1: return 'CANCELLED';
      case 2: return 'UNKNOWN';
      case 3: return 'INVALID_ARGUMENT';
      case 4: return 'DEADLINE_EXCEEDED';
      case 5: return 'NOT_FOUND';
      case 6: return 'ALREADY_EXISTS';
      case 7: return 'PERMISSION_DENIED';
      case 8: return 'RESOURCE_EXHAUSTED';
      case 9: return 'FAILED_PRECONDITION';
      case 10: return 'ABORTED';
      case 11: return 'OUT_OF_RANGE';
      case 12: return 'UNIMPLEMENTED';
      case 13: return 'INTERNAL';
      case 14: return 'UNAVAILABLE';
      case 15: return 'DATA_LOSS';
      case 16: return 'UNAUTHENTICATED';
      default: return `GRPC_ERROR_${err.code}`;
    }
  }
  const msg = err.message || '';
  for (const code of ['PERMISSION_DENIED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'INVALID_ARGUMENT', 'NOT_FOUND']) {
    if (msg.includes(code)) return code;
  }
  return 'FIRESTORE_WRITE_FAILED';
}

export async function withFirestore<T>(
  label: string,
  op: () => Promise<T>,
  opts?: { timeoutMs?: number; retries?: number }
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const maxRetries = opts?.retries ?? 2;
  const backoffs = [400, 1200];

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const timeoutErr = new Error(`Firestore operation '${label}' timed out after ${timeoutMs}ms`);
          (timeoutErr as any).code = 'DEADLINE_EXCEEDED';
          reject(timeoutErr);
        }, timeoutMs);
      });

      const result = await Promise.race([op(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      lastError = err;

      const shouldRetry = attempt < maxRetries && isRetriableError(err);
      if (shouldRetry) {
        const delay = backoffs[attempt] || 1200;
        console.warn(`[withFirestore:${label}] Attempt ${attempt + 1} failed with ${err.code || err.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retriable or retries exhausted
      break;
    }
  }

  const errCode = extractErrorCode(lastError);
  const errMsg = lastError?.message || 'अज्ञात त्रुटि';
  throw new PersistenceError({
    code: errCode,
    layer: 'firestore',
    message: `Firestore मा लेख्न सकिएन — ${errCode}: ${errMsg}`,
    cause: lastError,
  });
}

// Global persistence degradation state
let PERSISTENCE_DEGRADED = false;
let persistenceDiagnostics = {
  canRead: false,
  canWrite: false,
  readLatencyMs: 0,
  writeLatencyMs: 0,
  error: null as string | null,
};

export function isPersistenceDegraded(): boolean {
  return PERSISTENCE_DEGRADED;
}

export function setPersistenceDegraded(degraded: boolean): void {
  PERSISTENCE_DEGRADED = degraded;
}

export function getPersistenceDiagnostics() {
  return { ...persistenceDiagnostics };
}

export interface PersistenceVerificationResult {
  ok: boolean;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  firestore: {
    connected: boolean;
    databaseId: string;
    projectId: string;
    readLatencyMs: number;
    writeLatencyMs: number;
    error?: string;
  };
  sql: {
    configured: boolean;
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  localStore: {
    accessible: boolean;
    filePath: string;
    error?: string;
  };
  diagnostics: {
    canRead: boolean;
    canWrite: boolean;
    readLatencyMs: number;
    writeLatencyMs: number;
    error: string | null;
  };
  message: string;
  timestamp: string;
}

/**
 * Verifies persistence connectivity across Firestore, optional Cloud SQL, and Local Cache.
 * Executes on application startup and health checks to ensure reliable database access.
 */
export async function verifyPersistence(opts?: { timeoutMs?: number }): Promise<PersistenceVerificationResult> {
  const timeoutMs = opts?.timeoutMs ?? 6000;
  const now = new Date().toISOString();
  const dbId = getFirestoreDatabaseId();
  const projectId = process.env.FIREBASE_PROJECT_ID || 'inner-volt-dxfhk';

  let firestoreConnected = false;
  let writeLatencyMs = 0;
  let readLatencyMs = 0;
  let firestoreError: string | undefined;

  // 1. Verify Firestore with read/write test
  const testDocRef = adminDb.collection('_system').doc('_healthcheck');
  try {
    const writeStart = Date.now();
    await Promise.race([
      testDocRef.set({ timestamp: now, test: true, initiator: 'verifyPersistence' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Firestore write test timed out (${timeoutMs}ms)`)), timeoutMs)),
    ]);
    writeLatencyMs = Date.now() - writeStart;

    const readStart = Date.now();
    const snap = await Promise.race([
      testDocRef.get(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error(`Firestore read test timed out (${timeoutMs}ms)`)), timeoutMs)),
    ]);
    readLatencyMs = Date.now() - readStart;

    // Clean up test document
    testDocRef.delete().catch(() => {});

    if (snap && snap.exists) {
      firestoreConnected = true;
      PERSISTENCE_DEGRADED = false;
      persistenceDiagnostics = {
        canRead: true,
        canWrite: true,
        readLatencyMs,
        writeLatencyMs,
        error: null,
      };
      console.log(`[Persistence Verification] ✅ Firestore healthy (write: ${writeLatencyMs}ms, read: ${readLatencyMs}ms, db: ${dbId})`);
    } else {
      throw new Error('Firestore healthcheck document was not found after write');
    }
  } catch (err: any) {
    firestoreConnected = false;
    PERSISTENCE_DEGRADED = true;
    firestoreError = err?.message || String(err);
    persistenceDiagnostics = {
      canRead: false,
      canWrite: false,
      readLatencyMs: 0,
      writeLatencyMs: 0,
      error: firestoreError,
    };
    console.error(`[Persistence Verification] ❌ Firestore connectivity issue:`, {
      projectId,
      databaseId: dbId,
      error: firestoreError,
      code: err?.code,
    });
  }

  // 2. Verify Cloud SQL / PostgreSQL (Optional / Secondary)
  let sqlConfigured = false;
  let sqlConnected = false;
  let sqlLatencyMs: number | undefined;
  let sqlError: string | undefined;

  try {
    const isSqlConfigured = Boolean(process.env.SQL_HOST || process.env.DATABASE_URL || process.env.SQL_DB_NAME);
    sqlConfigured = isSqlConfigured;

    if (isSqlConfigured) {
      const { createPool } = await import('../../db/index.ts');
      const pool = createPool();
      const sqlStart = Date.now();
      const sqlTestPromise = pool.query('SELECT 1 as ping');
      await Promise.race([
        sqlTestPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SQL ping timed out (3000ms)')), 3000)),
      ]);
      sqlLatencyMs = Date.now() - sqlStart;
      sqlConnected = true;
      console.log(`[Persistence Verification] ✅ SQL Database connected (${sqlLatencyMs}ms)`);
    }
  } catch (sqlErr: any) {
    sqlConnected = false;
    sqlError = sqlErr?.message || String(sqlErr);
    console.warn(`[Persistence Verification] ℹ️ SQL Database check notice:`, sqlError);
  }

  // 3. Verify Local File Store accessibility
  let localStoreAccessible = false;
  const localDbPath = path.resolve(process.cwd(), 'data/app-database.json');
  let localError: string | undefined;
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    localStoreAccessible = fs.existsSync(dataDir);
  } catch (locErr: any) {
    localError = locErr?.message || String(locErr);
  }

  // Determine overall health status
  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';
  let message = 'डेटाबेस जडान सामान्य र सुरक्षित छ।';

  if (!firestoreConnected) {
    if (localStoreAccessible) {
      overallStatus = 'DEGRADED';
      message = 'क्लाउड फायरस्टोरमा ढिलाइ वा समस्या छ — प्रणाली स्थानीय क्यास (Local Store) मा चल्दैछ।';
    } else {
      overallStatus = 'FAILED';
      message = 'डेटाबेस जडान पूर्णतया असफल भएको छ। कृपया इन्टरनेट वा फायरबेस प्रमाणीकरण जाँच गर्नुहोस्।';
    }
  }

  return {
    ok: firestoreConnected,
    status: overallStatus,
    firestore: {
      connected: firestoreConnected,
      databaseId: dbId,
      projectId,
      readLatencyMs,
      writeLatencyMs,
      error: firestoreError,
    },
    sql: {
      configured: sqlConfigured,
      connected: sqlConnected,
      latencyMs: sqlLatencyMs,
      error: sqlError,
    },
    localStore: {
      accessible: localStoreAccessible,
      filePath: localDbPath,
      error: localError,
    },
    diagnostics: { ...persistenceDiagnostics },
    message,
    timestamp: now,
  };
}

