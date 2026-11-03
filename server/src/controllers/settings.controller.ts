import { Request, Response } from 'express';
import { settingsService } from '../services/settings.service';

export class SettingsController {
  async getSettings(req: Request, res: Response) {
    const settings = await settingsService.getSettings();
    res.json(settings);
  }

  async setTariff(req: Request, res: Response) {
    const tariff = Number(req.body.tariff ?? req.body.tariffInrPerKwh);
    const result = await settingsService.setTariff(tariff);
    res.json(result);
  }

  async setMode(req: Request, res: Response) {
    const { mode } = req.body;
    const result = await settingsService.setMode(mode);
    res.json(result);
  }
}

export const settingsController = new SettingsController();
