import { prisma } from '../config/db';
import { Schedule, ScheduleException, Prisma } from '@prisma/client';

export class ScheduleRepository {
  async findAll(): Promise<Schedule[]> {
    return prisma.schedule.findMany({
      orderBy: [{ acUnitId: 'asc' }, { weekday: 'asc' }],
    });
  }

  async findByUnitAndDay(acUnitId: string, weekday: number): Promise<Schedule | null> {
    return prisma.schedule.findFirst({
      where: { acUnitId, weekday },
    });
  }

  async upsert(data: {
    id?: string;
    acUnitId: string;
    weekday: number;
    onTime: string;
    offTime: string;
    setpointC: number;
    active: boolean;
    priority?: number;
  }): Promise<Schedule> {
    const id = data.id || `sch_${data.acUnitId}_${data.weekday}`;
    return prisma.schedule.upsert({
      where: { id },
      update: {
        onTime: data.onTime,
        offTime: data.offTime,
        setpointC: data.setpointC,
        active: data.active,
        priority: data.priority ?? 1,
      },
      create: {
        id,
        acUnitId: data.acUnitId,
        weekday: data.weekday,
        onTime: data.onTime,
        offTime: data.offTime,
        setpointC: data.setpointC,
        active: data.active,
        priority: data.priority ?? 1,
      },
    });
  }

  async update(id: string, data: Prisma.ScheduleUpdateInput): Promise<Schedule> {
    return prisma.schedule.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Schedule> {
    return prisma.schedule.delete({
      where: { id },
    });
  }

  async findExceptionsByDate(date: string): Promise<ScheduleException[]> {
    return prisma.scheduleException.findMany({
      where: { date },
    });
  }

  async createException(data: Prisma.ScheduleExceptionUncheckedCreateInput): Promise<ScheduleException> {
    return prisma.scheduleException.create({ data });
  }
}

export const scheduleRepository = new ScheduleRepository();
