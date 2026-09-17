import crypto from 'crypto';
import { adminAuth } from '../../lib/firebase-admin.ts';

export interface SessionTokenPayload {
  uid: string;
  username: string;
  email: string;
  role: string;
  organizationId: string;
  iat: number;
  exp: number;
}

const DEFAULT_SECRET = process.env.SESSION_SECRET || 'np-payroll-production-secret-2081-secure-auth-token-key';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Base64 URL encode
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generate a cryptographically signed HMAC-SHA256 session token
 */
export function createSessionToken(user: {
  uid: string;
  username: string;
  email?: string;
  role: string;
  organizationId?: string;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    uid: user.uid,
    username: user.username,
    email: user.email || `${user.username}@system.local`,
    role: user.role,
    organizationId: user.organizationId || 'all',
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', DEFAULT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

/**
 * Verify HMAC-SHA256 session token
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', DEFAULT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Timing safe comparison
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  try {
    const payload: SessionTokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export interface VerifiedAuthToken {
  uid: string;
  email?: string;
  role?: string;
  organizationId?: string;
  source: 'firebase' | 'session';
}

/**
 * Verifies either a Firebase ID Token or a server-signed Session Token.
 * NEVER accepts a raw UID.
 */
export async function verifyAnyAuthToken(token: string): Promise<VerifiedAuthToken> {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: Token is empty');
  }

  // 1. Try Firebase Admin verifyIdToken
  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    if (decodedFirebase && decodedFirebase.uid) {
      return {
        uid: decodedFirebase.uid,
        email: decodedFirebase.email,
        role: decodedFirebase.role as string | undefined,
        organizationId: decodedFirebase.organizationId as string | undefined,
        source: 'firebase',
      };
    }
  } catch (firebaseErr) {
    // If not a Firebase ID token, fallback to server session token
  }

  // 2. Try Server Session Token (HMAC-SHA256 JWT)
  const sessionPayload = verifySessionToken(token);
  if (sessionPayload && sessionPayload.uid) {
    return {
      uid: sessionPayload.uid,
      email: sessionPayload.email,
      role: sessionPayload.role,
      organizationId: sessionPayload.organizationId,
      source: 'session',
    };
  }

  throw new Error('Invalid token: Token signature verification failed');
}
