import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

export const validateBody = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Validation failed', error.format()));
      } else {
        next(error);
      }
    }
  };
};

export const validateQuery = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Query validation failed', error.format()));
      } else {
        next(error);
      }
    }
  };
};
