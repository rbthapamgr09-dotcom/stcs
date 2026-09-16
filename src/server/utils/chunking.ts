/**
 * Document size estimation and chunking utilities for Firestore limits (max 1 MiB)
 */

import { PersistenceError } from '../repositories/firestoreGuard.ts';

export function estimateBytes(obj: any): number {
  if (obj === null || obj === undefined) return 0;
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return Buffer.byteLength(str, 'utf8');
  } catch {
    return 0;
  }
}

export function assertUnderLimit(obj: any, maxBytes = 900_000, label = 'Document'): void {
  const bytes = estimateBytes(obj);
  if (bytes > maxBytes) {
    throw new PersistenceError({
      code: 'PAYLOAD_TOO_LARGE',
      layer: 'firestore',
      message: `${label} को आकार (${Math.round(bytes / 1024)} KB) Firestore को सुरक्षित सीमा (${Math.round(maxBytes / 1024)} KB) भन्दा ठूलो छ।`,
    });
  }
}

/**
 * Split array of operations or items into batches of at most batchSize (default 400, Firestore limit is 500)
 */
export function chunkArray<T>(array: T[], batchSize = 400): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    chunks.push(array.slice(i, i + batchSize));
  }
  return chunks;
}
