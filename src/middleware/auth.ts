import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  getUserByFirebaseUid,
  getUserByUid,
  getUserByUsernameOrEmailOrUid,
  linkFirebaseUidToUser,
} from '../db/users.ts';
import { getOrganizationById } from '../db/payroll.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken & {
    dbUser?: any;
    organizationId?: string;
    role?: string;
  };
  dbUser?: any;
}

async function resolveDbUser(decodedToken: DecodedIdToken) {
  let dbUser = await getUserByFirebaseUid(decodedToken.uid);
  if (!dbUser) {
    dbUser = await getUserByUid(decodedToken.uid);
  }
  if (!dbUser && decodedToken.email) {
    dbUser = await getUserByUsernameOrEmailOrUid(decodedToken.email);
    if (dbUser && !dbUser.firebaseUid) {
      await linkFirebaseUidToUser(dbUser.id, decodedToken.uid);
    }
  }
  return dbUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const dbUser = await resolveDbUser(decodedToken);

    if (dbUser) {
      if (dbUser.isActive === false) {
        return res.status(403).json({ error: 'खाता निष्क्रिय छ (Account is inactive).', inactive: true });
      }

      if (dbUser.organizationId && dbUser.organizationId !== 'all' && dbUser.organizationId !== 'org_default') {
        const org = await getOrganizationById(dbUser.organizationId);
        if (org && org.isActive === false) {
          return res.status(403).json({ error: 'सम्बन्धित कार्यालय निष्क्रिय छ (Office is inactive).', officeInactive: true });
        }
      }

      req.dbUser = dbUser;
      req.user = {
        ...decodedToken,
        dbUser,
        role: dbUser.role,
        organizationId: dbUser.organizationId,
      };
    } else {
      req.user = decodedToken;
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Optional auth middleware for endpoints that can be accessed with or without login
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const dbUser = await resolveDbUser(decodedToken);
      if (dbUser) {
        req.dbUser = dbUser;
        req.user = {
          ...decodedToken,
          dbUser,
          role: dbUser.role,
          organizationId: dbUser.organizationId,
        };
      } else {
        req.user = decodedToken;
      }
    } catch {
      // ignore invalid token in optional auth
    }
  }
  next();
};
