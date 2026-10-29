import { Request, Response } from 'express';
import { temperatureService } from '../services/temperature.service';

export class TemperatureController {
  async getRoomTemperature(req: Request, res: Response) {
    const { id } = req.params;
    const data = await temperatureService.getRoomTemperature(id);
    res.json(data);
  }

  async updateThresholds(req: Request, res: Response) {
    const { id } = req.params;
    const { minTempC, maxTempC } = req.body;
    const room = await temperatureService.updateRoomThresholds(id, minTempC, maxTempC);
    res.json(room);
  }

  async setSetpoint(req: Request, res: Response) {
    const { id } = req.params;
    const { setpointC } = req.body;
    const result = await temperatureService.setAcSetpoint(id, setpointC, req.user?.id);
    res.json(result);
  }
}

export const temperatureController = new TemperatureController();
