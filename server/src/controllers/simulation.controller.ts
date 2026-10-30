import { Request, Response } from 'express';
import { simulationService } from '../services/simulation.service';
import { BadRequest } from '../utils/errors';

export class SimulationController {
  async createSimulation(req: Request, res: Response) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let readingsContent = '';
    let scheduleContent = '';
    let configObj: any = {};
    let readingsFilename = 'synthetic_demo.csv';
    let scheduleFilename = 'weekly_schedule.csv';

    // 1. Check for multipart/form-data files
    if (files && files['readingsFile'] && files['readingsFile'][0]) {
      readingsContent = files['readingsFile'][0].buffer.toString('utf-8');
      readingsFilename = files['readingsFile'][0].originalname;
    }
    if (files && files['scheduleFile'] && files['scheduleFile'][0]) {
      scheduleContent = files['scheduleFile'][0].buffer.toString('utf-8');
      scheduleFilename = files['scheduleFile'][0].originalname;
    }

    // 2. Parse config from body (can be JSON string from FormData or raw JSON)
    if (req.body.config) {
      if (typeof req.body.config === 'string') {
        try {
          configObj = JSON.parse(req.body.config);
        } catch {
          configObj = {};
        }
      } else {
        configObj = req.body.config;
      }
    }

    // 3. Fallback for raw JSON body if uploaded via JSON directly
    if (!readingsContent && req.body.readingsContent) {
      readingsContent = req.body.readingsContent;
    }
    if (!scheduleContent && req.body.scheduleContent) {
      scheduleContent = req.body.scheduleContent;
    }

    if (!readingsContent || !scheduleContent) {
      throw new BadRequest('Both readingsFile and scheduleFile must be provided');
    }

    const result = await simulationService.createSimulation(
      req.user?.id,
      readingsContent,
      scheduleContent,
      configObj,
      readingsFilename,
      scheduleFilename
    );

    res.status(201).json(result);
  }

  async getSimulation(req: Request, res: Response) {
    const { id } = req.params;
    const afterStep = req.query.afterStep !== undefined ? parseInt(req.query.afterStep as string, 10) : undefined;
    const simulation = await simulationService.getSimulation(id, afterStep);
    res.json(simulation);
  }

  async listSimulations(req: Request, res: Response) {
    const list = await simulationService.listSimulations();
    res.json(list);
  }

  async deleteSimulation(req: Request, res: Response) {
    const { id } = req.params;
    await simulationService.deleteSimulation(id);
    res.json({ success: true, message: `Simulation ${id} deleted` });
  }

  async pauseReplay(req: Request, res: Response) {
    const { id } = req.params;
    const success = simulationService.pauseReplay(id);
    res.json({ success });
  }

  async resumeReplay(req: Request, res: Response) {
    const { id } = req.params;
    const success = simulationService.resumeReplay(id);
    res.json({ success });
  }

  async stopReplay(req: Request, res: Response) {
    const { id } = req.params;
    const success = simulationService.stopReplay(id);
    res.json({ success });
  }

  async setSpeed(req: Request, res: Response) {
    const { id } = req.params;
    const { speed } = req.body;
    const success = simulationService.setReplaySpeed(id, speed);
    res.json({ success });
  }

  async seekReplay(req: Request, res: Response) {
    const { id } = req.params;
    const { targetMinuteIndex } = req.body;
    const success = simulationService.seekReplay(id, Number(targetMinuteIndex) || 0);
    res.json({ success });
  }

  async restartReplay(req: Request, res: Response) {
    const { id } = req.params;
    const success = simulationService.restartReplay(id);
    res.json({ success });
  }
}

export const simulationController = new SimulationController();
