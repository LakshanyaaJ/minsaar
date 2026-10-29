import { Router } from 'express';
import multer from 'multer';
import { simulationController } from '../controllers/simulation.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { optionalAuth } from '../middleware/authGuard';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

export const simulationRoutes = Router();

simulationRoutes.post(
  '/',
  optionalAuth,
  upload.fields([
    { name: 'readingsFile', maxCount: 1 },
    { name: 'scheduleFile', maxCount: 1 },
  ]),
  asyncHandler(simulationController.createSimulation.bind(simulationController))
);

simulationRoutes.get('/', asyncHandler(simulationController.listSimulations.bind(simulationController)));
simulationRoutes.get('/:id', asyncHandler(simulationController.getSimulation.bind(simulationController)));
simulationRoutes.delete('/:id', asyncHandler(simulationController.deleteSimulation.bind(simulationController)));

simulationRoutes.post('/:id/pause', asyncHandler(simulationController.pauseReplay.bind(simulationController)));
simulationRoutes.post('/:id/resume', asyncHandler(simulationController.resumeReplay.bind(simulationController)));
simulationRoutes.post('/:id/stop', asyncHandler(simulationController.stopReplay.bind(simulationController)));
simulationRoutes.post('/:id/speed', asyncHandler(simulationController.setSpeed.bind(simulationController)));
simulationRoutes.post('/:id/seek', asyncHandler(simulationController.seekReplay.bind(simulationController)));
simulationRoutes.post('/:id/restart', asyncHandler(simulationController.restartReplay.bind(simulationController)));
