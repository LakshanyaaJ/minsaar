import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { CONSTANTS } from './config/constants';
import { prisma } from './config/db';
import { AppError, NotFound } from './utils/errors';
import { routes } from './routes';
import crypto from 'crypto';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: CONSTANTS.BODY_LIMIT }));
app.use(cookieParser());
app.use(pinoHttp({
  genReqId: () => crypto.randomUUID(),
  autoLogging: env.NODE_ENV !== 'test',
  quietReqLogger: true,
}));

app.get('/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime(), database: true });
  } catch (error) {
    res.status(503).json({ status: 'error', uptime: process.uptime(), database: false });
  }
});

app.use('/api', routes);

app.use('*', (req, res, next) => {
  next(new NotFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV !== 'test') {
    req.log.error(err);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details }
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      ...(env.NODE_ENV === 'development' && { details: err.message })
    }
  });
});