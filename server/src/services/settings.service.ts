import { settingRepository } from '../repositories/setting.repository';

export class SettingsService {
  async getSettings(): Promise<{ tariffInrPerKwh: number; timezone: string; mode: 'simulation' | 'live' }> {
    const [tariff, mode, tz] = await Promise.all([
      settingRepository.get('tariff'),
      settingRepository.get('system_mode'),
      settingRepository.get('timezone'),
    ]);

    return {
      tariffInrPerKwh: tariff?.tariffInrPerKwh ?? 8.0,
      mode: mode?.mode ?? 'simulation',
      timezone: tz?.timezone ?? 'Asia/Kolkata',
    };
  }

  async setTariff(tariffInrPerKwh: number) {
    await settingRepository.set('tariff', { tariffInrPerKwh });
    return { tariffInrPerKwh };
  }

  async setMode(mode: 'simulation' | 'live') {
    await settingRepository.set('system_mode', { mode });
    return { mode };
  }
}

export const settingsService = new SettingsService();
