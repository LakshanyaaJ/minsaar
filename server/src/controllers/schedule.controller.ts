import { Request, Response } from 'express';
import { scheduleService } from '../services/schedule.service';

export class ScheduleController {
  async getSchedules(req: Request, res: Response) {
    const schedules = await scheduleService.getSchedules();
    res.json(schedules);
  }

  async upsertSchedule(req: Request, res: Response) {
    const schedule = await scheduleService.upsertSchedule(req.body);
    res.json(schedule);
  }

  async updateSchedule(req: Request, res: Response) {
    const { id } = req.params;
    const schedule = await scheduleService.updateSchedule(id, req.body);
    res.json(schedule);
  }

  async deleteSchedule(req: Request, res: Response) {
    const { id } = req.params;
    await scheduleService.deleteSchedule(id);
    res.json({ success: true, message: `Schedule ${id} deleted` });
  }

  async createException(req: Request, res: Response) {
    const exception = await scheduleService.createException(req.body);
    res.json(exception);
  }

  async bulkUpsert(req: Request, res: Response) {
    await scheduleService.bulkUpsert(req.body.schedules || []);
    res.json({ success: true, message: 'Schedules updated successfully' });
  }
}

export const scheduleController = new ScheduleController();
