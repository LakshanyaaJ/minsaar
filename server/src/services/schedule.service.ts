import { scheduleRepository } from '../repositories/schedule.repository';
import { Schedule } from '@prisma/client';

export class ScheduleService {
  async getSchedules(): Promise<Schedule[]> {
    return scheduleRepository.findAll();
  }

  async upsertSchedule(schedule: {
    id?: string;
    acUnitId: string;
    weekday: number;
    onTime: string;
    offTime: string;
    setpointC: number;
    active: boolean;
  }): Promise<Schedule> {
    return scheduleRepository.upsert(schedule);
  }

  async updateSchedule(id: string, updates: any): Promise<Schedule> {
    return scheduleRepository.update(id, updates);
  }

  async deleteSchedule(id: string): Promise<Schedule> {
    return scheduleRepository.delete(id);
  }

  async createException(data: {
    acUnitId: string;
    date: string;
    kind: string;
    note?: string;
  }) {
    return scheduleRepository.createException(data);
  }

  async bulkUpsert(schedules: any[]): Promise<void> {
    for (const sch of schedules) {
      await scheduleRepository.upsert(sch);
    }
  }
}

export const scheduleService = new ScheduleService();
