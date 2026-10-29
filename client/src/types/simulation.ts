import type { Anomaly } from './domain';

export interface SimulationRunConfig {
  intervalHours: number; // 1 to 168
  tariffInrPerKwh: number;
}

export interface SimulationStep {
  stepIndex: number;
  windowStart: string;
  windowEnd: string;
  actualKwh: number;
  predictedKwh: number;
  forecastNextKwh: number;
  anomalies: Anomaly[];
  wastedKwhEst: number;
  outsideScheduleHours: boolean;
  tempStatus: {
    below: boolean;
    within: boolean;
    above: boolean;
  };
  recommendationIds: string[];
}

export interface SimulationSummary {
  totalActualKwh: number;
  totalPredictedKwh: number;
  mae: number;
  rmse: number;
  r2: number;
  anomaliesByCategory: Record<string, number>;
  totalAnomalies: number;
  wastedKwhEst: number;
  savingsKwhEst: number;
  savingsInrEst: number;
  scheduleCompliancePct: number;
  perRoom: {
    room: string;
    actualKwh: number;
    wastedKwhEst: number;
    anomalies: number;
  }[];
  engine: 'mock' | 'ml';
}

export interface SimulationJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number; // 0 to 1
  stepsCompleted: number;
  stepsTotal: number;
  steps: SimulationStep[];
  summary?: SimulationSummary;
  config: SimulationRunConfig;
  createdAt: string;
  error?: string;
}