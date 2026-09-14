import { OrganizationItem, User } from '../types';

/**
 * Normalizes text for comparison (trims spaces, converts to lowercase)
 */
export function normalizeKey(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Deduplicates an array of Organizations by ID and Office Name.
 * Merges properties of duplicates so no information is lost.
 */
export function deduplicateOrganizations(orgs: OrganizationItem[]): OrganizationItem[] {
  if (!Array.isArray(orgs) || orgs.length === 0) return [];

  const mapById = new Map<string, OrganizationItem>();
  const mapByName = new Map<string, OrganizationItem>();

  for (const rawOrg of orgs) {
    if (!rawOrg) continue;
    const cleanOrg: OrganizationItem = {
      ...rawOrg,
      id: rawOrg.id || `org_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      officeName: rawOrg.officeName || rawOrg.name || 'कार्यालय',
      name: rawOrg.name || rawOrg.officeName || 'कार्यालय',
      isActive: rawOrg.isActive !== false,
    };

    const normName = normalizeKey(cleanOrg.officeName);
    const normId = cleanOrg.id;

    // Check if we already encountered an org with the same ID or same Office Name
    let existing = mapById.get(normId) || (normName ? mapByName.get(normName) : undefined);

    if (existing) {
      // Merge properties (preferring non-empty string values and updated information)
      const merged: OrganizationItem = {
        ...existing,
        ...cleanOrg,
        id: existing.id || cleanOrg.id,
        officeName: existing.officeName || cleanOrg.officeName,
        name: existing.name || cleanOrg.name,
        ministryName: existing.ministryName || cleanOrg.ministryName || '',
        departmentName: existing.departmentName || cleanOrg.departmentName || '',
        parentBodyName: existing.parentBodyName || cleanOrg.parentBodyName || '',
        province: existing.province || cleanOrg.province || '',
        district: existing.district || cleanOrg.district || '',
        localLevel: existing.localLevel || cleanOrg.localLevel || '',
        address: existing.address || cleanOrg.address || '',
        phone: existing.phone || cleanOrg.phone || '',
        mobile: existing.mobile || cleanOrg.mobile || '',
        email: existing.email || cleanOrg.email || '',
        whatsapp: existing.whatsapp || cleanOrg.whatsapp || '',
        pan: existing.pan || cleanOrg.pan || '',
        registrationNo: existing.registrationNo || cleanOrg.registrationNo || '',
        spreadsheetId: cleanOrg.spreadsheetId || existing.spreadsheetId || '',
        spreadsheetUrl: cleanOrg.spreadsheetUrl || existing.spreadsheetUrl || '',
        webAppUrl: cleanOrg.webAppUrl || existing.webAppUrl || '',
        driveFolderId: cleanOrg.driveFolderId || existing.driveFolderId || '',
        isActive: existing.isActive && cleanOrg.isActive,
        updatedAt: cleanOrg.updatedAt || existing.updatedAt || new Date().toISOString(),
      };

      mapById.set(merged.id, merged);
      if (normName) mapByName.set(normName, merged);
    } else {
      mapById.set(normId, cleanOrg);
      if (normName) mapByName.set(normName, cleanOrg);
    }
  }

  return Array.from(mapById.values());
}

/**
 * Role hierarchy value for deduplication merging
 */
const ROLE_PRIORITY: Record<string, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  ACCOUNTANT: 3,
  GENERAL_USER: 2,
  VIEWER: 1,
};

/**
 * Deduplicates an array of Users by username and ID.
 * Merges properties of duplicate user accounts so credentials and roles are maintained properly.
 */
export function deduplicateUsers(users: User[]): User[] {
  if (!Array.isArray(users) || users.length === 0) return [];

  const mapByUsername = new Map<string, User>();
  const mapById = new Map<string, User>();

  for (const rawUser of users) {
    if (!rawUser || !rawUser.username) continue;

    const normUsername = normalizeKey(rawUser.username).replace(/\s+/g, '');
    if (!normUsername) continue;

    const cleanUser: User = {
      ...rawUser,
      username: normUsername,
      id: rawUser.id || `user_${normUsername}`,
      isActive: rawUser.isActive !== false,
    };

    let existing = mapByUsername.get(normUsername) || mapById.get(cleanUser.id);

    if (existing) {
      const existingRolePriority = ROLE_PRIORITY[existing.role] || 1;
      const cleanRolePriority = ROLE_PRIORITY[cleanUser.role] || 1;
      const primaryRole = cleanRolePriority >= existingRolePriority ? cleanUser.role : existing.role;

      // Prefer non-empty fields and higher privilege role
      const merged: User = {
        ...existing,
        ...cleanUser,
        id: existing.id || cleanUser.id,
        username: normUsername,
        role: primaryRole,
        fullName: (cleanRolePriority >= existingRolePriority ? cleanUser.fullName : existing.fullName) || cleanUser.fullName || existing.fullName,
        password: cleanUser.password && cleanUser.password.length > 10 ? cleanUser.password : (existing.password || cleanUser.password),
        email: cleanUser.email && !cleanUser.email.endsWith('@system.local') ? cleanUser.email : (existing.email || cleanUser.email),
        phone: cleanUser.phone || existing.phone || '',
        organizationId: (primaryRole === 'SUPER_ADMIN' ? 'all' : (cleanUser.organizationId || existing.organizationId)),
        organizationName: (primaryRole === 'SUPER_ADMIN' ? 'समग्र प्रणाली (All Offices)' : (cleanUser.organizationName || existing.organizationName)),
        designation: cleanUser.designation || existing.designation || '',
        securityPin: cleanUser.securityPin || existing.securityPin || '1234',
        securityQuestion: cleanUser.securityQuestion || existing.securityQuestion || 'तपाईंको पहिलो विद्यालयको नाम के हो?',
        securityAnswer: cleanUser.securityAnswer || existing.securityAnswer || 'नेपाल',
        isActive: existing.isActive !== false && cleanUser.isActive !== false,
        mustChangePassword: existing.mustChangePassword && cleanUser.mustChangePassword,
      };

      mapByUsername.set(normUsername, merged);
      mapById.set(merged.id, merged);
    } else {
      mapByUsername.set(normUsername, cleanUser);
      mapById.set(cleanUser.id, cleanUser);
    }
  }

  return Array.from(mapByUsername.values());
}

/**
 * Checks if an Office Name is already used by another Organization
 */
export function isDuplicateOrganization(
  officeName: string,
  existingOrgs: OrganizationItem[],
  excludeId?: string
): { isDuplicate: boolean; matchedOrg?: OrganizationItem } {
  const normTarget = normalizeKey(officeName);
  if (!normTarget) return { isDuplicate: false };

  const matchedOrg = existingOrgs.find((o) => {
    if (excludeId && o.id === excludeId) return false;
    const normName = normalizeKey(o.officeName || o.name);
    return normName === normTarget;
  });

  return {
    isDuplicate: Boolean(matchedOrg),
    matchedOrg,
  };
}

/**
 * Checks if a Username or Email is already used by another User
 */
export function isDuplicateUser(
  username: string,
  email: string | undefined,
  existingUsers: User[],
  excludeId?: string
): { isDuplicate: boolean; reason?: 'username' | 'email'; matchedUser?: User } {
  const normUser = normalizeKey(username).replace(/\s+/g, '');
  const normEmail = email ? normalizeKey(email) : '';

  for (const u of existingUsers) {
    if (!u) continue;
    if (excludeId && u.id === excludeId) continue;

    const uName = normalizeKey(u.username).replace(/\s+/g, '');
    if (normUser && uName === normUser) {
      return { isDuplicate: true, reason: 'username', matchedUser: u };
    }

    if (
      normEmail &&
      !normEmail.endsWith('@system.local') &&
      u.email &&
      normalizeKey(u.email) === normEmail &&
      !u.email.endsWith('@system.local')
    ) {
      return { isDuplicate: true, reason: 'email', matchedUser: u };
    }
  }

  return { isDuplicate: false };
}
