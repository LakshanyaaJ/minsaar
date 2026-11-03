import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { Forbidden, Unauthorized } from '../utils/errors';

export const roleGuard = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new Unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new Forbidden('You do not have permission to perform this action'));
    }

    next();
  };
};
