import { Router } from 'express';
import { overviewController } from '../controllers/overview.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const overviewRoutes = Router();

overviewRoutes.get('/', asyncHandler(overviewController.getOverview.bind(overviewController)));
