import { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyAnyAuthToken, VerifiedAuthToken } from '../server/auth/tokenService.ts';
import {
  getUserByFirebaseUid,
  getUserByUid,
  getUserByUsernameOrEmailOrUid,
  linkFirebaseUid,
} from '../server/repositories/userRepo.ts';
import { getOfficeById } from '../server/repositories/officeRepo.ts';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
    organizationId?: string;
    dbUser?: any;
    tokenSource?: 'firebase' | 'session';
  };
  dbUser?: any;
}

async function resolveDbUser(uid: string, email?: string) {
  let dbUser = await getUserByFirebaseUid(uid);
  if (!dbUser) {
    dbUser = await getUserByUid(uid);
  }
  if (!dbUser && email) {
    dbUser = await getUserByUsernameOrEmailOrUid(email);
    if (dbUser && !dbUser.firebaseUid) {
      await linkFirebaseUid(dbUser.uid, uid).catch(() => {});
    }
  }
  return dbUser;
}

/**
 * Enforces valid, cryptographically signed Bearer tokens (Firebase ID Token or HMAC Session Token).
 * NEVER treats raw UID as authentication.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_MISSING_TOKEN',
      error: 'प्रमाणीकरण टोकन फेला परेन। कृपया लगइन गर्नुहोस्।',
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_EMPTY_TOKEN',
      error: 'टोकन खाली छ। कृपया पुनः लगइन गर्नुहोस्।',
    });
  }

  try {
    const verified: VerifiedAuthToken = await verifyAnyAuthToken(token);
    const dbUser = await resolveDbUser(verified.uid, verified.email);

    if (dbUser) {
      if (dbUser.isActive === false) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_INACTIVE',
          error: 'यो खाता निष्क्रिय (Inactive) गरिएको छ। कृपया प्रशासकसँग सम्पर्क गर्नुहोस्।',
          inactive: true,
        });
      }

      if (dbUser.organizationId && dbUser.organizationId !== 'all' && dbUser.organizationId !== 'org_default') {
        const org = await getOfficeById(dbUser.organizationId);
        if (org && org.isActive === false) {
          return res.status(403).json({
            success: false,
            code: 'OFFICE_INACTIVE',
            error: 'सम्बन्धित कार्यालय हाल निष्क्रिय गरिएको छ।',
            officeInactive: true,
          });
        }
      }

      req.dbUser = dbUser;
      req.user = {
        uid: dbUser.uid,
        email: dbUser.email || verified.email,
        role: dbUser.role || verified.role || 'GENERAL_USER',
        organizationId: dbUser.organizationId || verified.organizationId || 'all',
        dbUser,
        tokenSource: verified.source,
      };
    } else {
      req.user = {
        uid: verified.uid,
        email: verified.email,
        role: verified.role || 'GENERAL_USER',
        organizationId: verified.organizationId || 'all',
        tokenSource: verified.source,
      };
    }

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_INVALID_TOKEN',
      error: 'प्रमाणीकरण टोकन अमान्य वा म्याद सकिएको छ। कृपया पुनः लगइन गर्नुहोस्।',
      details: error?.message,
    });
  }
};

/**
 * Optional authentication: Populates req.user if a valid token is present,
 * but does not reject requests without tokens.
 * NEVER populates req.user with raw UIDs.
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        const verified = await verifyAnyAuthToken(token);
        const dbUser = await resolveDbUser(verified.uid, verified.email);
        if (dbUser && dbUser.isActive !== false) {
          req.dbUser = dbUser;
          req.user = {
            uid: dbUser.uid,
            email: dbUser.email || verified.email,
            role: dbUser.role || verified.role,
            organizationId: dbUser.organizationId || verified.organizationId,
            dbUser,
            tokenSource: verified.source,
          };
        } else if (verified) {
          req.user = {
            uid: verified.uid,
            email: verified.email,
            role: verified.role,
            organizationId: verified.organizationId,
            tokenSource: verified.source,
          };
        }
      } catch {
        // Optional auth proceeds unauthenticated on invalid token
      }
    }
  }
  next();
};

/**
 * Role-Based Access Control: Require SUPER_ADMIN role
 */
export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_SUPER_ADMIN_REQUIRED',
      error: 'यो कार्य गर्न केवल सुपर प्रशासक (Super Admin) लाई मात्र अनुमति छ।',
    });
  }
  next();
};

/**
 * Role-Based Access Control: Require ADMIN or SUPER_ADMIN role
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_ADMIN_REQUIRED',
      error: 'यो कार्य गर्न प्रशासक (Admin) अनुमति आवश्यक छ।',
    });
  }
  next();
};

/**
 * Multi-Tenant Isolation Middleware:
 * Verifies that the authenticated user has rights to access or mutate the requested organization.
 * SUPER_ADMIN has access to all organizations.
 * ADMIN, ACCOUNTANT, and VIEWER are restricted strictly to their own organizationId.
 */
export const requireOrgAccess = (orgIdParam: string = 'orgId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'कृपया लगइन गर्नुहोस्।',
      });
    }

    // SUPER_ADMIN has universal access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const targetOrgId = req.params[orgIdParam] || req.body?.organizationId || req.body?.orgId || req.query?.orgId;

    if (!targetOrgId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_ORG_ID',
        error: 'कार्यालय पहिचान (Organization ID) आवश्यक छ।',
      });
    }

    if (req.user.organizationId !== targetOrgId) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_CROSS_TENANT',
        error: 'तपाईंलाई अर्को कार्यालयको विवरण हेर्ने वा परिवर्तन गर्ने अनुमति छैन।',
      });
    }

    next();
  };
};
