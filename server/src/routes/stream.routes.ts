import { Router } from 'express';
import { streamController } from '../controllers/stream.controller';

export const streamRoutes = Router();

streamRoutes.get('/', streamController.stream.bind(streamController));
