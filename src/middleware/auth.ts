import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  getUserByFirebaseUid,
  getUserByUid,
  getUserByUsernameOrEmailOrUid,
  linkFirebaseUid,
} from '../server/repositories/userRepo.ts';
import { getOfficeById } from '../server/repositories/officeRepo.ts';

export interface AuthRequest extends Request {
  user?: (Partial<DecodedIdToken> & {
    uid: string;
    email?: string;
    role?: string;
    organizationId?: string;
    dbUser?: any;
  });
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
      await linkFirebaseUid(dbUser.uid, uid);
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

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  try {
    let decodedToken: any = null;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (verifyErr: any) {
      // If token is a raw UID or session identifier
      const directUser = await getUserByUid(token);
      if (directUser) {
        decodedToken = { uid: directUser.uid, email: directUser.email };
      } else {
        return res.status(401).json({ error: 'Unauthorized: Invalid token', details: verifyErr?.message });
      }
    }

    const dbUser = await resolveDbUser(decodedToken.uid, decodedToken.email);

    if (dbUser) {
      if (dbUser.isActive === false) {
        return res.status(403).json({ error: 'खाता निष्क्रिय छ (Account is inactive).', inactive: true });
      }

      if (dbUser.organizationId && dbUser.organizationId !== 'all' && dbUser.organizationId !== 'org_default') {
        const org = await getOfficeById(dbUser.organizationId);
        if (org && org.isActive === false) {
          return res.status(403).json({ error: 'सम्बन्धित कार्यालय निष्क्रिय छ (Office is inactive).', officeInactive: true });
        }
      }

      req.dbUser = dbUser;
      req.user = {
        ...decodedToken,
        uid: decodedToken.uid,
        email: decodedToken.email || dbUser.email,
        dbUser,
        role: dbUser.role,
        organizationId: dbUser.organizationId,
      };
    } else {
      req.user = {
        ...decodedToken,
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: 'GENERAL_USER',
      };
    }

    next();
  } catch (error: any) {
    console.error('[requireAuth] Authentication error:', error?.message || error);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
};

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
        let decodedToken: any = null;
        try {
          decodedToken = await adminAuth.verifyIdToken(token);
        } catch {
          const directUser = await getUserByUid(token);
          if (directUser) {
            decodedToken = { uid: directUser.uid, email: directUser.email };
          }
        }

        if (decodedToken) {
          const dbUser = await resolveDbUser(decodedToken.uid, decodedToken.email);
          req.dbUser = dbUser;
          req.user = {
            ...decodedToken,
            uid: decodedToken.uid,
            email: decodedToken.email || dbUser?.email,
            dbUser,
            role: dbUser?.role,
            organizationId: dbUser?.organizationId,
          };
        }
      } catch (e) {
        // Optional auth does not fail the request on invalid token
      }
    }
  }
  next();
};
