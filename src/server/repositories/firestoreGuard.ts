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
