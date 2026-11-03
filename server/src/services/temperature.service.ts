import { roomRepository } from '../repositories/room.repository';
import { acUnitRepository } from '../repositories/building.repository';
import { readingRepository } from '../repositories/reading.repository';
import { prisma } from '../config/db';
import { NotFound } from '../utils/errors';
import { eventBus } from './eventBus.service';

export class TemperatureService {
  async getRoomTemperature(roomId: string) {
    const room = await roomRepository.findById(roomId);
    if (!room) throw new NotFound(`Room ${roomId} not found`);

    const acUnits = await acUnitRepository.findByRoomId(roomId);
    const primaryUnit = acUnits[0];

    const recentReadings = await readingRepository.findRecentByRoom(roomId, 24);
    const lastReading = recentReadings[recentReadings.length - 1];

    const indoorTempC = lastReading?.roomTempC ?? 23.5;
    const outdoorTempC = lastReading?.outdoorTempC ?? 28.4;
    const setpointC = lastReading?.setTempC ?? 24.0;
    const occupancy = lastReading?.occupancy ?? 0;

    return {
      roomId: room.id,
      roomName: room.name,
      indoorTempC,
      outdoorTempC,
      setpointC,
      minBoundC: room.minTempC,
      maxBoundC: room.maxTempC,
      occupancy,
      activeUnitId: primaryUnit?.id,
      history: recentReadings.map(r => ({
        time: r.timestamp.toISOString(),
        indoor: r.roomTempC,
        setpoint: r.setTempC,
        occupancy: r.occupancy,
      })),
    };
  }

  async updateRoomThresholds(roomId: string, minTempC: number, maxTempC: number) {
    const room = await roomRepository.findById(roomId);
    if (!room) throw new NotFound(`Room ${roomId} not found`);
    return roomRepository.updateThresholds(roomId, minTempC, maxTempC);
  }

  async setAcSetpoint(acUnitId: string, setpointC: number, userId?: string) {
    const unit = await acUnitRepository.findById(acUnitId);
    if (!unit) throw new NotFound(`AC unit ${acUnitId} not found`);

    // Log control command
    const command = await prisma.controlCommand.create({
      data: {
        acUnitId,
        commandType: 'SETPOINT',
        payload: { setpointC },
        plannedOrSent: 'sent',
        status: 'executed',
        reason: 'Authorized manual setpoint override from control dashboard.',
        createdBy: userId,
      },
    });

    eventBus.emitEvent({
      type: 'command',
      data: command,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      commandId: command.id,
      acUnitId,
      setpointC,
    };
  }
}

export const temperatureService = new TemperatureService();
