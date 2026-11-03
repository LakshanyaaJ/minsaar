import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { simulationService } from '../services/simulation.service';
import { BadRequest, NotFound } from '../utils/errors';

function getSyntheticDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '../synthetic_data'),
    path.resolve(process.cwd(), 'synthetic_data'),
    path.resolve(__dirname, '../../../synthetic_data'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

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

    // 4. If scheduleContent is missing, fallback to synthetic_data/weekly_schedule.csv
    if (readingsContent && !scheduleContent) {
      const synthDir = getSyntheticDataDir();
      const synthSchedulePath = path.join(synthDir, 'weekly_schedule.csv');
      if (fs.existsSync(synthSchedulePath)) {
        scheduleContent = fs.readFileSync(synthSchedulePath, 'utf-8');
        scheduleFilename = 'weekly_schedule.csv';
      }
    }

    if (!readingsContent || !scheduleContent) {
      throw new BadRequest('Telemetry readings CSV must be provided');
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

  async loadDemoPreset(req: Request, res: Response) {
    const synthDir = getSyntheticDataDir();
    const readingsPath = path.join(synthDir, 'synthetic_demo.csv');
    const schedulePath = path.join(synthDir, 'weekly_schedule.csv');

    if (!fs.existsSync(readingsPath) || !fs.existsSync(schedulePath)) {
      throw new NotFound('Demo files not found on server in synthetic_data');
    }

    const readingsContent = fs.readFileSync(readingsPath, 'utf-8');
    const scheduleContent = fs.readFileSync(schedulePath, 'utf-8');

    res.json({
      success: true,
      readingsContent,
      scheduleContent,
      readingsFilename: 'synthetic_demo.csv',
      scheduleFilename: 'weekly_schedule.csv',
    });
  }

  async getDemoFiles(req: Request, res: Response) {
    const synthDir = getSyntheticDataDir();
    const { type } = req.query;
    const filename = type === 'schedule' ? 'weekly_schedule.csv' : 'synthetic_demo.csv';
    const filePath = path.join(synthDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFound(`Demo file ${filename} not found`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
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
