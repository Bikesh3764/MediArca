import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { isClinicActive } from '../utils/authGuards';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'CLINIC' | 'RECEPTIONIST';
  fullName: string;
  mustChangePassword?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Validates and retrieves the active JWT secret.
 * Enforces strict production fail-closed requirement:
 * In production, JWT_SECRET MUST be set, cannot match the fallback, and must be at least 32 characters.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret || secret === 'mediarca-fallback-jwt-secret') {
    if (isProduction) {
      throw new Error('FATAL: In production, JWT_SECRET must be configured in environment variables and cannot use default fallback.');
    }
    return 'mediarca-dev-test-secret-min-32-characters-secure';
  }

  if (isProduction && secret.length < 32) {
    throw new Error('FATAL: In production, JWT_SECRET must be at least 32 characters long for cryptographic security.');
  }

  return secret;
};

/**
 * Authentication middleware: enforces Bearer token in Authorization header.
 * Query-string token transport is strictly disallowed to prevent token leakage in URLs, logs, and history (Finding H2).
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication token is missing or invalid' });
    return;
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token has expired or is invalid' });
  }
};

/**
 * Optional authentication: decodes Bearer token if provided in Authorization header,
 * attaching req.user, but proceeds cleanly without error if unauthenticated.
 */
export const optionalAuthenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (token) {
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Ignored for optional authentication
    }
  }
  next();
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
      return;
    }
    next();
  };
};

/**
 * Enforces that a RECEPTIONIST user is strictly ACTIVE and not PENDING or REJECTED (Finding H5).
 */
export const requireActiveReceptionist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || req.user.role !== 'RECEPTIONIST') {
    res.status(403).json({ success: false, message: 'Access denied: Receptionist role required' });
    return;
  }

  try {
    const receptionist = await prisma.receptionistProfile.findUnique({
      where: { userId: req.user.id },
      include: { clinic: true },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found' });
      return;
    }

    if (receptionist.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        message:
          receptionist.status === 'REJECTED'
            ? 'Your receptionist application has been declined by clinic administration.'
            : 'Your receptionist application is pending approval by clinic administration.',
      });
      return;
    }

    if (receptionist.clinic) {
      const clinicCheck = isClinicActive(receptionist.clinic);
      if (!clinicCheck.active) {
        res.status(403).json({
          success: false,
          message:
            clinicCheck.reason ||
            'The affiliated clinic facility is pending verification or is suspended. Desk operations are locked.',
        });
        return;
      }
    }

    next();
  } catch (error: any) {
    console.error('requireActiveReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify receptionist account status' });
  }
};

/**
 * Enforces that a CLINIC user's facility is strictly VERIFIED and not SUSPENDED or PENDING (Finding M6).
 */
export const requireActiveClinic = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || req.user.role !== 'CLINIC') {
    res.status(403).json({ success: false, message: 'Access denied: Clinic role required' });
    return;
  }

  try {
    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    if (!clinic.isVerified || clinic.verificationStatus !== 'VERIFIED') {
      res.status(403).json({
        success: false,
        message:
          clinic.verificationStatus === 'SUSPENDED'
            ? 'Access denied: Your clinic facility is currently suspended by administration.'
            : clinic.verificationStatus === 'REJECTED'
            ? 'Access denied: Your clinic registration has been declined by administration.'
            : 'Access denied: Your clinic facility is pending administrative verification.',
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('requireActiveClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify clinic account status' });
  }
};
