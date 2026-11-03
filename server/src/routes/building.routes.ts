import { Router } from 'express';
import { buildingController } from '../controllers/overview.controller';
import { temperatureController } from '../controllers/temperature.controller';
import { validateBody } from '../middleware/validate';
import { thresholdSchema, setpointSchema } from '../validators/temperature.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { optionalAuth } from '../middleware/authGuard';

export const buildingRoutes = Router();
export const roomRoutes = Router();
export const acUnitRoutes = Router();

// /buildings
buildingRoutes.get('/', asyncHandler(buildingController.getBuildings.bind(buildingController)));

// /rooms
roomRoutes.get('/', asyncHandler(buildingController.getRooms.bind(buildingController)));
roomRoutes.get('/:id/temperature', asyncHandler(temperatureController.getRoomTemperature.bind(temperatureController)));
roomRoutes.put('/:id/thresholds', validateBody(thresholdSchema), asyncHandler(temperatureController.updateThresholds.bind(temperatureController)));

// /ac-units
acUnitRoutes.get('/', asyncHandler(buildingController.getAcUnits.bind(buildingController)));
acUnitRoutes.post('/:id/setpoint', optionalAuth, validateBody(setpointSchema), asyncHandler(temperatureController.setSetpoint.bind(temperatureController)));
