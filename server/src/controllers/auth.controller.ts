import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { env } from '../config/env';

export class AuthController {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user,
      token, // Also return token in body for testing/flexibility
    });
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
  }

  async me(req: Request, res: Response) {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }
    const user = await authService.getMe(req.user.id);
    res.json({ user });
  }
}

export const authController = new AuthController();
