import { Router } from 'express';
import { scheduleController } from '../controllers/schedule.controller';
import { validateBody } from '../middleware/validate';
import { scheduleUpsertSchema, scheduleExceptionSchema, bulkScheduleSchema } from '../validators/schedule.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const scheduleRoutes = Router();

scheduleRoutes.get('/', asyncHandler(scheduleController.getSchedules.bind(scheduleController)));
scheduleRoutes.post('/', validateBody(scheduleUpsertSchema), asyncHandler(scheduleController.upsertSchedule.bind(scheduleController)));
scheduleRoutes.post('/bulk', validateBody(bulkScheduleSchema), asyncHandler(scheduleController.bulkUpsert.bind(scheduleController)));
scheduleRoutes.post('/exceptions', validateBody(scheduleExceptionSchema), asyncHandler(scheduleController.createException.bind(scheduleController)));
scheduleRoutes.put('/:id', asyncHandler(scheduleController.updateSchedule.bind(scheduleController)));
scheduleRoutes.delete('/:id', asyncHandler(scheduleController.deleteSchedule.bind(scheduleController)));
