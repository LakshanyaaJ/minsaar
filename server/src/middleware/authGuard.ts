import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Unauthorized } from '../utils/errors';
import { AuthUser, JwtPayload } from '../types/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
  // Check HTTP-only cookie first, fallback to Authorization header
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/, '');

  if (!token) {
    return next(new Unauthorized('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.email.split('@')[0],
      role: decoded.role,
    };
    next();
  } catch (err) {
    next(new Unauthorized('Invalid or expired token'));
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/, '');
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.email.split('@')[0],
      role: decoded.role,
    };
  } catch (err) {
    // Ignore invalid token for optional auth
  }
  next();
};
