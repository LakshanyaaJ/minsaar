import { prisma } from '../config/db';
import { Building, Room, AcUnit } from '@prisma/client';

export class BuildingRepository {
  async findAll(): Promise<Building[]> {
    return prisma.building.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Building | null> {
    return prisma.building.findUnique({ where: { id } });
  }
}

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

export class AcUnitRepository {
  async findAll(): Promise<AcUnit[]> {
    return prisma.acUnit.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: string): Promise<AcUnit | null> {
    return prisma.acUnit.findUnique({ where: { id } });
  }

  async findByRoomId(roomId: string): Promise<AcUnit[]> {
    return prisma.acUnit.findMany({ where: { roomId } });
  }
}

export const buildingRepository = new BuildingRepository();
export const roomRepository = new RoomRepository();
export const acUnitRepository = new AcUnitRepository();
