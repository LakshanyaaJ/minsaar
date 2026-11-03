import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { validateBody } from '../middleware/validate';
import { tariffSchema, systemModeSchema } from '../validators/settings.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const settingsRoutes = Router();

settingsRoutes.get('/', asyncHandler(settingsController.getSettings.bind(settingsController)));
settingsRoutes.post('/tariff', validateBody(tariffSchema), asyncHandler(settingsController.setTariff.bind(settingsController)));
settingsRoutes.put('/tariff', validateBody(tariffSchema), asyncHandler(settingsController.setTariff.bind(settingsController)));
settingsRoutes.put('/mode', validateBody(systemModeSchema), asyncHandler(settingsController.setMode.bind(settingsController)));
