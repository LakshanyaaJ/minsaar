import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { loginSchema } from '../validators/auth.validator';
import { loginLimiter } from '../middleware/rateLimiter';
import { authGuard } from '../middleware/authGuard';
import { asyncHandler } from '../utils/asyncHandler';

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(authController.login.bind(authController)));
authRoutes.post('/logout', asyncHandler(authController.logout.bind(authController)));
authRoutes.get('/me', authGuard, asyncHandler(authController.me.bind(authController)));
