import { buildingRepository, roomRepository, acUnitRepository } from '../repositories/building.repository';
import { readingRepository } from '../repositories/reading.repository';
import { settingRepository } from '../repositories/setting.repository';
import { OverviewMetrics } from '../types/domain';

export class BuildingService {
  async getBuildings() {
    return buildingRepository.findAll();
  }

  async getRooms() {
    return roomRepository.findAll();
  }

  async getAcUnits() {
    return acUnitRepository.findAll();
  }

  async getOverview(range = 'Today'): Promise<OverviewMetrics> {
    const stats = await readingRepository.getOverviewStats(range);
    const tariffSetting = await settingRepository.get('tariff');
    const tariff = tariffSetting?.tariffInrPerKwh ?? 8.0;

    const estSavingsInr = Math.round(stats.totalKwh * 0.22 * tariff);

    return {
      totalKwh: stats.totalKwh,
      estSavings: estSavingsInr,
      anomaliesCount: stats.anomaliesCount,
      unitsActive: stats.unitsActive,
      occupancyRate: stats.occupancyRate,
    };
  }
}

export const buildingService = new BuildingService();
