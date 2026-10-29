import { prisma } from '../config/db';
import { Room } from '@prisma/client';

export class RoomRepository {
  async findAll(): Promise<Room[]> {
    return prisma.room.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Room | null> {
    return prisma.room.findUnique({ where: { id } });
  }

  async updateThresholds(id: string, minTempC: number, maxTempC: number): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data: { minTempC, maxTempC },
    });
  }
}

export const roomRepository = new RoomRepository();
