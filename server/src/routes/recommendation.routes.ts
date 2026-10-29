import { Router } from 'express';
import { recommendationController } from '../controllers/recommendation.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const recommendationRoutes = Router();

recommendationRoutes.get('/', asyncHandler(recommendationController.getRecommendations.bind(recommendationController)));
recommendationRoutes.patch('/:id', asyncHandler(recommendationController.patchRecommendation.bind(recommendationController)));
