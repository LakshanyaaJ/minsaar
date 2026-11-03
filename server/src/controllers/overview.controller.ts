import { Request, Response } from 'express';
import { buildingService } from '../services/building.service';

export class OverviewController {
  async getOverview(req: Request, res: Response) {
    const range = (req.query.range as string) || 'Today';
    const overview = await buildingService.getOverview(range);
    res.json(overview);
  }
}

export class BuildingController {
  async getBuildings(req: Request, res: Response) {
    const buildings = await buildingService.getBuildings();
    res.json(buildings);
  }

  async getRooms(req: Request, res: Response) {
    const rooms = await buildingService.getRooms();
    res.json(rooms);
  }

  async getAcUnits(req: Request, res: Response) {
    const acUnits = await buildingService.getAcUnits();
    res.json(acUnits);
  }
}

export const overviewController = new OverviewController();
export const buildingController = new BuildingController();
