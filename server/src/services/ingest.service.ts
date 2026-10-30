import { readingRepository } from '../repositories/reading.repository';
import { eventBus } from './eventBus.service';
import { env } from '../config/env';
import { Unauthorized } from '../utils/errors';

export interface IngestReading {
  acUnitId: string;
  roomId?: string;
  timestamp: string;
  powerKw: number;
  energyKwh?: number;
  setTempC: number;
  roomTempC: number;
  occupancy: number;
  onOff: boolean;
  outdoorTempC?: number;
  dataSource?: 'measured' | 'simulated' | 'predicted' | 'estimated' | 'uploaded';
}

export class IngestService {
  async ingestReadings(apiKey: string | undefined, readings: IngestReading[]): Promise<{ count: number }> {
    if (apiKey !== env.DEVICE_API_KEY) {
      throw new Unauthorized('Invalid or missing device API key');
    }

    const dbReadings = readings.map(r => ({
      acUnitId: r.acUnitId,
      roomId: r.roomId,
      timestamp: new Date(r.timestamp),
      powerKw: r.powerKw,
      energyKwh: r.energyKwh ?? (r.powerKw * 0.25),
      setTempC: r.setTempC,
      roomTempC: r.roomTempC,
      occupancy: r.occupancy,
      onOff: r.onOff,
      outdoorTempC: r.outdoorTempC,
      dataSource: r.dataSource ?? 'measured',
    }));

    const count = await readingRepository.createMany(dbReadings);

    // Emit event for last reading in batch
    if (readings.length > 0) {
      const last = readings[readings.length - 1];
      eventBus.emitEvent({
        type: 'reading',
        data: last,
        timestamp: new Date().toISOString(),
      });
    }

    return { count };
  }
}

export const ingestService = new IngestService();
