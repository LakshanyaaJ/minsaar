import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import pino from 'pino';

const logger = pino();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));