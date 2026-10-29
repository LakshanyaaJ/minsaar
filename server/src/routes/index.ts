import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { overviewRoutes } from './overview.routes';
import { buildingRoutes, roomRoutes, acUnitRoutes } from './building.routes';
import { scheduleRoutes } from './schedule.routes';
import { recommendationRoutes } from './recommendation.routes';
import { settingsRoutes } from './settings.routes';
import { simulationRoutes } from './simulation.routes';
import { ingestRoutes } from './ingest.routes';
import { streamRoutes } from './stream.routes';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/overview', overviewRoutes);
routes.use('/buildings', buildingRoutes);
routes.use('/rooms', roomRoutes);
routes.use('/ac-units', acUnitRoutes);
routes.use('/schedules', scheduleRoutes);
routes.use('/recommendations', recommendationRoutes);
routes.use('/settings', settingsRoutes);
routes.use('/simulations', simulationRoutes);
routes.use('/ingest', ingestRoutes);
routes.use('/stream', streamRoutes);