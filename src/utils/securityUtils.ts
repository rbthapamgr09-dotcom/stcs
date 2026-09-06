/**
 * Security and Privacy Utilities for Nepal Payroll & Tax Calculation System
 * Provides cryptographic hashing, brute-force rate-limiting, PII data masking,
 * input sanitization, security audit logging, and data integrity verification.
 */

// --- 1. Cryptographic Password Hashing & Verification ---

/**
 * Standard FIPS PUB 180-4 Synchronous SHA-256 implementation
 */
function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Sync(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isPrime[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s0_h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const s1_h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const t1 =
        hash[7] +
        s1_h +
        ch +
        k[i] +
        (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const t2 = s0_h + maj;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + t1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (t1 + t2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Generates a random cryptographic salt hex string
 */
export function generateSalt(length = 16): string {
  try {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }
}

/**
 * Synchronous password hasher using salted SHA-256
 */
export function hashPasswordSync(
  password: string,
  salt?: string
): { hash: string; salt: string; encoded: string } {
  const activeSalt = salt || generateSalt(16);
  const hashHex = sha256Sync(activeSalt + ':' + password);
  return {
    hash: hashHex,
    salt: activeSalt,
    encoded: `sha256:${activeSalt}:${hashHex}`,
  };
}

/**
 * Synchronously verifies a plain password against a stored password string.
 * Transparently supports both modern hashed passwords (`sha256:salt:hash`)
 * and legacy plain-text passwords for backward compatibility.
 */
export function verifyPasswordSync(
  plainInput: string,
  storedPassword?: string
): { isValid: boolean; needsUpgrade: boolean } {
  if (!storedPassword) {
    return { isValid: false, needsUpgrade: false };
  }

  // Check if stored in modern hashed format
  if (storedPassword.startsWith('sha256:')) {
    const parts = storedPassword.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      const computedHash = sha256Sync(salt + ':' + plainInput);
      return {
        isValid: computedHash === expectedHash,
        needsUpgrade: false,
      };
    }
  }

  // Legacy plain text check
  const isMatch = plainInput === storedPassword;
  return {
    isValid: isMatch,
    needsUpgrade: isMatch, // If it matched as plain text, it should be upgraded to hashed
  };
}

/**
 * Hashes a password string with SHA-256 and salt using the native Web Crypto API
 */
export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ hash: string; salt: string; encoded: string }> {
  const activeSalt = salt || generateSalt(16);
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(activeSalt + ':' + password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return {
      hash: hashHex,
      salt: activeSalt,
      encoded: `sha256:${activeSalt}:${hashHex}`,
    };
  } catch {
    return hashPasswordSync(password, activeSalt);
  }
}

/**
 * Verifies a plain password against a stored password string.
 */
export async function verifyPassword(
  plainInput: string,
  storedPassword?: string
): Promise<{ isValid: boolean; needsUpgrade: boolean }> {
  return verifyPasswordSync(plainInput, storedPassword);
}

// --- 2. Brute-Force Rate Limiting (Login & Security Verification) ---

interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  lockoutUntil: number;
}

const RATE_LIMIT_STORAGE_KEY = 'nepal_payroll_rate_limits';

function getRateLimitStore(): Record<string, RateLimitRecord> {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRateLimitStore(store: Record<string, RateLimitRecord>): void {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Checks if an action is allowed under rate-limiting rules.
 * Default: 5 attempts within 2 minutes; lockout for 60 seconds if exceeded.
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts = 5,
  lockoutDurationSeconds = 60,
  windowDurationSeconds = 120
): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  isLocked: boolean;
} {
  const store = getRateLimitStore();
  const record = store[identifier.toLowerCase().trim()];
  const now = Date.now();

  if (!record) {
    return {
      allowed: true,
      remainingAttempts: maxAttempts,
      retryAfterSeconds: 0,
      isLocked: false,
    };
  }

  // Check if currently locked out
  if (record.lockoutUntil && record.lockoutUntil > now) {
    const retryAfter = Math.ceil((record.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
      isLocked: true,
    };
  }

  // Reset if window duration has passed
  if (now - record.firstAttemptTime > windowDurationSeconds * 1000) {
    delete store[identifier.toLowerCase().trim()];
    saveRateLimitStore(store);
    return {
      allowed: true,
      remainingAttempts: maxAttempts,
      retryAfterSeconds: 0,
      isLocked: false,
    };
  }

  const remaining = Math.max(0, maxAttempts - record.attempts);
  return {
    allowed: remaining > 0,
    remainingAttempts: remaining,
    retryAfterSeconds: 0,
    isLocked: remaining <= 0,
  };
}

/**
 * Records a failed attempt for an identifier
 */
export function recordFailedAttempt(
  identifier: string,
  maxAttempts = 5,
  lockoutDurationSeconds = 60
): {
  remainingAttempts: number;
  isLocked: boolean;
  retryAfterSeconds: number;
} {
  const store = getRateLimitStore();
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const record = store[key] || {
    attempts: 0,
    firstAttemptTime: now,
    lockoutUntil: 0,
  };

  record.attempts += 1;

  if (record.attempts >= maxAttempts) {
    record.lockoutUntil = now + lockoutDurationSeconds * 1000;
  }

  store[key] = record;
  saveRateLimitStore(store);

  const isLocked = record.attempts >= maxAttempts;
  const retryAfterSeconds = isLocked ? lockoutDurationSeconds : 0;
  const remainingAttempts = Math.max(0, maxAttempts - record.attempts);

  return { remainingAttempts, isLocked, retryAfterSeconds };
}

/**
 * Resets the rate limit counter for an identifier after successful action
 */
export function resetRateLimit(identifier: string): void {
  const store = getRateLimitStore();
  const key = identifier.toLowerCase().trim();
  if (store[key]) {
    delete store[key];
    saveRateLimitStore(store);
  }
}

// --- 3. PII & Sensitive Data Masking (Privacy Mode) ---

/**
 * Masks a bank account number showing only the last 4 digits
 * e.g. "0123456789012" -> "•••• •••• ••012"
 */
export function maskAccountNumber(accountNo?: string): string {
  if (!accountNo) return '-';
  const clean = accountNo.trim();
  if (clean.length <= 4) return clean;
  const lastFour = clean.slice(-4);
  return '•••• •••• ' + lastFour;
}

/**
 * Masks a citizenship number
 * e.g. "27-01-78-12345" -> "••••••••-12345"
 */
export function maskCitizenship(citizenshipNo?: string): string {
  if (!citizenshipNo) return '-';
  const clean = citizenshipNo.trim();
  if (clean.length <= 4) return clean;
  const lastFour = clean.slice(-4);
  return '••••••••' + lastFour;
}

/**
 * Masks a PAN number
 * e.g. "123456789" -> "••••••789"
 */
export function maskPan(pan?: string): string {
  if (!pan) return '-';
  const clean = pan.trim();
  if (clean.length <= 3) return clean;
  const lastThree = clean.slice(-3);
  return '••••••' + lastThree;
}

/**
 * Masks a phone/mobile number
 * e.g. "9851234567" -> "98•••••567"
 */
export function maskPhone(phone?: string): string {
  if (!phone) return '-';
  const clean = phone.trim();
  if (clean.length <= 5) return clean;
  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(-3);
  return `${prefix}•••••${suffix}`;
}

/**
 * Masks an email address: e.g. "account@gov.np" -> "ac••••@gov.np"
 */
export function maskEmail(email?: string): string {
  if (!email) return '-';
  const parts = email.split('@');
  if (parts.length !== 2) return '••••••';
  const [user, domain] = parts;
  if (user.length <= 2) return `*@${domain}`;
  const visible = user.slice(0, 2);
  return `${visible}••••@${domain}`;
}

/**
 * Universal sensitive data masking dispatcher
 */
export function maskSensitiveData(
  value?: string,
  type: 'bank' | 'pan' | 'phone' | 'email' | 'citizenship' = 'bank'
): string {
  if (!value) return '-';
  switch (type) {
    case 'bank':
      return maskAccountNumber(value);
    case 'pan':
      return maskPan(value);
    case 'phone':
      return maskPhone(value);
    case 'email':
      return maskEmail(value);
    case 'citizenship':
      return maskCitizenship(value);
    default:
      return '••••••••';
  }
}

// --- 4. Input Sanitization & Formula Injection Protection ---

/**
 * Sanitizes input text to prevent Cross-Site Scripting (XSS)
 */
export function sanitizeInput(text?: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/onload|onerror|onclick|onmouseover/gi, '')
    .trim();
}

/**
 * Prevents CSV / Excel formula injection (DDE attacks)
 * If a cell starts with =, +, -, @, or tab, prepend a single quote
 */
export function sanitizeSpreadsheetCell(val: any): any {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (['=', '+', '-', '@', '\t', '\r'].some((char) => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }
  return trimmed;
}

// --- 5. Security Audit Log System (Chronological immutable audit trail) ---

export type SecurityAuditAction =
  | 'USER_LOGIN_SUCCESS'
  | 'USER_LOGIN_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'USER_LOGOUT'
  | 'SCREEN_LOCKED'
  | 'SCREEN_UNLOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'ROLE_CHANGED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_DELETED'
  | 'BULK_EMPLOYEES_IMPORTED'
  | 'SALARY_SETUP_UPDATED'
  | 'DEDUCTION_SETUP_UPDATED'
  | 'TAX_REFERENCE_UPDATED'
  | 'ORGANIZATION_UPDATED'
  | 'BACKUP_EXPORTED'
  | 'BACKUP_RESTORED'
  | 'SYSTEM_DATA_CLEARED'
  | 'GOOGLE_SHEETS_SYNC'
  | 'SECURITY_SETTINGS_UPDATED';

export interface SecurityAuditLogItem {
  id: string;
  timestamp: string; // ISO String
  nepaliTimestamp: string; // BS date & time
  userId: string;
  username: string;
  userRole: string;
  action: SecurityAuditAction;
  actionTitleNepali: string;
  category: 'AUTH' | 'USER_MGMT' | 'DATA_CHANGE' | 'SYSTEM' | 'SECURITY';
  description: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  details?: string;
  ipOrDevice?: string;
}

const AUDIT_LOG_STORAGE_KEY = 'nepal_payroll_security_audit_logs';
const MAX_AUDIT_LOG_ENTRIES = 500;

export const AUDIT_ACTION_TITLES: Record<SecurityAuditAction, string> = {
  USER_LOGIN_SUCCESS: 'लगइन सफल',
  USER_LOGIN_FAILED: 'लगइन असफल (प्रयास)',
  RATE_LIMIT_EXCEEDED: 'अति धेरै गलत प्रयास (दर सीमा नाघ्यो)',
  USER_LOGOUT: 'लगआउट',
  SCREEN_LOCKED: 'स्क्रिन लक गरिएको',
  SCREEN_UNLOCKED: 'स्क्रिन अनलक गरिएको',
  PASSWORD_CHANGED: 'पासवर्ड परिवर्तन',
  PASSWORD_RESET: 'पासवर्ड रिसेट',
  USER_CREATED: 'नयाँ प्रयोगकर्ता सिर्जना',
  USER_UPDATED: 'प्रयोगकर्ता विवरण अद्यावधिक',
  USER_DELETED: 'प्रयोगकर्ता खाता हटाइएको',
  ROLE_CHANGED: 'भूमिका/अनुमति परिवर्तन',
  EMPLOYEE_CREATED: 'नयाँ कर्मचारी थप',
  EMPLOYEE_UPDATED: 'कर्मचारी विवरण अद्यावधिक',
  EMPLOYEE_DELETED: 'कर्मचारी रेकर्ड हटाइएको',
  BULK_EMPLOYEES_IMPORTED: 'एकमुष्ठ कर्मचारी आयात (Excel)',
  SALARY_SETUP_UPDATED: 'तलब स्केल/भत्ता अद्यावधिक',
  DEDUCTION_SETUP_UPDATED: 'कट्टी विवरण अद्यावधिक',
  TAX_REFERENCE_UPDATED: 'कर स्ल्याब तथा नियम अद्यावधिक',
  ORGANIZATION_UPDATED: 'कार्यालय विवरण अद्यावधिक',
  BACKUP_EXPORTED: 'डाटा ब्याकअप डाउनलोड',
  BACKUP_RESTORED: 'डाटा ब्याकअप पुनःस्थापना',
  SYSTEM_DATA_CLEARED: 'प्रणाली डाटा रिसेट/क्लियर',
  GOOGLE_SHEETS_SYNC: 'गुगल सिट्स सिङ्क्रोनाइजेसन',
  SECURITY_SETTINGS_UPDATED: 'सुरक्षा सेटिङ्स अद्यावधिक',
};

/**
 * Retrieves all stored security audit logs
 */
export function getSecurityAuditLogs(): SecurityAuditLogItem[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Logs a security event into local audit storage
 */
export function logSecurityEvent(params: {
  action: SecurityAuditAction;
  category: 'AUTH' | 'USER_MGMT' | 'DATA_CHANGE' | 'SYSTEM' | 'SECURITY';
  userId?: string;
  username?: string;
  userRole?: string;
  description: string;
  status?: 'SUCCESS' | 'WARNING' | 'FAILED';
  details?: string;
}): SecurityAuditLogItem {
  const now = new Date();
  const logs = getSecurityAuditLogs();

  const userAgentSummary =
    typeof navigator !== 'undefined'
      ? navigator.userAgent.includes('Mobile')
        ? 'Mobile Device'
        : 'Desktop Browser'
      : 'Web Client';

  const newLog: SecurityAuditLogItem = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    nepaliTimestamp: now.toLocaleString('ne-NP'),
    userId: params.userId || 'system',
    username: params.username || 'अज्ञात',
    userRole: params.userRole || 'VIEWER',
    action: params.action,
    actionTitleNepali: AUDIT_ACTION_TITLES[params.action] || params.action,
    category: params.category,
    description: params.description,
    status: params.status || 'SUCCESS',
    details: params.details,
    ipOrDevice: userAgentSummary,
  };

  // Prepend and trim to max limit
  const updatedLogs = [newLog, ...logs].slice(0, MAX_AUDIT_LOG_ENTRIES);

  try {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
  } catch {
    // If quota exceeded, retain recent 100 entries
    try {
      localStorage.setItem(
        AUDIT_LOG_STORAGE_KEY,
        JSON.stringify(updatedLogs.slice(0, 100))
      );
    } catch {
      // Ignore storage errors
    }
  }

  return newLog;
}

/**
 * Clears security audit logs (restricted action)
 */
export function clearSecurityAuditLogs(): void {
  try {
    localStorage.removeItem(AUDIT_LOG_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// --- 6. Data Integrity & Backup Checksum (SHA-256) ---

/**
 * Computes a SHA-256 integrity checksum of a backup JSON object
 */
export async function generateDataChecksum(data: any): Promise<string> {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonStr);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies if an imported backup payload matches its embedded checksum
 */
export async function verifyDataChecksum(
  payloadData: any,
  providedChecksum?: string
): Promise<boolean> {
  if (!providedChecksum) return true; // Legacy backups without checksum
  const computed = await generateDataChecksum(payloadData);
  return computed.toLowerCase() === providedChecksum.toLowerCase();
}
