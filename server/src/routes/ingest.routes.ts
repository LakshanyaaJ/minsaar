import { Router } from 'express';
import { ingestController } from '../controllers/stream.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const ingestRoutes = Router();

ingestRoutes.post('/readings', asyncHandler(ingestController.ingestReadings.bind(ingestController)));
