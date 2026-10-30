import type { Anomaly } from './domain';

export type ReplaySpeed = '1x' | '10x' | '60x' | 'presentation';

export interface SimulationRunConfig {
  intervalHours: number; // 1 to 168
  tariffInrPerKwh: number;
  selectedHall?: string; // 'ALL' or specific hall ID like 'HALL_A'
  optimizationPolicy?: 'balanced' | 'aggressive' | 'comfort';
  mode?: 'batch' | 'replay';
  speed?: ReplaySpeed;
  presentationIntervalMs?: number;
}

export interface ReplayHallState {
  hallId: string;
  hallName: string;
  indoorTempC: number;
  outdoorTempC: number;
  occupancy: number;
  acOn: boolean;
  setpointC: number;
  powerKw: number;
  totalEnergyKwh: number;
  wastedKwh: number;
  savingsInr: number;
  coolingEffectivenessPct: number;
}

export interface ReplayTickData {
  jobId: string;
  status: 'running' | 'paused' | 'stopped' | 'done';
  simulatedTimestamp: string;
  currentMinuteIndex: number;
  totalMinutes: number;
  progress: number;
  elapsedWallClockMs: number;
  speed: ReplaySpeed;
  speedMultiplier: number;
  halls: Record<string, ReplayHallState>;
  aggregate: {
    totalEnergyKwh: number;
    predictedEnergyKwh: number;
    wastedEnergyKwh: number;
    savingsInrEst: number;
    totalAnomalies: number;
    mlAnomaliesCount: number;
    ruleAnomaliesCount: number;
  };
  chartPoint?: {
    timestamp: string;
    timeLabel: string;
    actualKwh: number;
    predictedKwh: number;
    wastedKwh: number;
  };
  latestAnomalies: SimulationAnomalyEvent[];
  latestRecommendations: SimulationRecommendation[];
  forecastStatus: string;
}

export interface HallSimulationMetrics {
  hallId: string;
  hallName: string;
  totalActualKwh: number;
  totalPredictedKwh: number;
  mae: number;
  rmse: number;
  occupiedHours: number;
  unoccupiedHours: number;
  acRuntimeHours: number;
  avgIndoorTempC: number;
  minIndoorTempC: number;
  maxIndoorTempC: number;
  mlAnomaliesCount: number;
  ruleAnomaliesCount: number;
  totalAnomalies: number;
  baselineCostInr: number;
  optimizedCostInr: number;
  savingsKwhEst: number;
  savingsInrEst: number;
  savingsPct: number;
  scheduleCompliancePct: number;
}

export interface SimulationAnomalyEvent {
  id: string;
  hallId: string;
  hallName: string;
  acUnitId: string;
  timestamp: string;
  category: 'runtime_after_hours' | 'setpoint_too_low' | 'excessive_power' | 'phantom_run' | 'model_outlier';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectionMethod: 'ml' | 'rule';
  observedKwh: number;
  expectedKwh: number;
  explanation: string;
  action: string;
}

export interface SimulationRecommendation {
  id: string;
  hallId: string;
  hallName: string;
  acUnitId: string;
  timestamp: string;
  currentState: string;
  command: 'ON' | 'OFF' | 'SETPOINT';
  targetSetpointC?: number;
  scheduleContext: string;
  occupancy: number;
  indoorTempC: number;
  comfortThreshold: string;
  reason: string;
  estimatedKwhSavings: number;
  estimatedCostSavings: number;
  status: 'Simulated';
  confidence: string;
}

export interface DateAlignmentInfo {
  readingsRange: { start: string; end: string; durationDays: number };
  scheduleRange: { start: string; end: string; durationDays: number };
  isAligned: boolean;
  explanation: string;
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
  byHall?: Record<string, {
    hallId: string;
    hallName: string;
    actualKwh: number;
    predictedKwh: number;
    wastedKwhEst: number;
    avgIndoorTempC: number;
    avgOccupancy: number;
    acOn: boolean;
    anomalies: any[];
  }>;
}

export interface SimulationSummary {
  totalActualKwh: number;
  totalPredictedKwh: number;
  mae: number;
  rmse: number;
  r2: number;
  anomaliesByCategory: Record<string, number>;
  totalAnomalies: number;
  mlAnomaliesCount?: number;
  ruleAnomaliesCount?: number;
  wastedKwhEst: number;
  savingsKwhEst: number;
  savingsInrEst: number;
  savingsPct?: number;
  baselineCostInr?: number;
  optimizedCostInr?: number;
  scheduleCompliancePct: number;
  perRoom: {
    room: string;
    actualKwh: number;
    wastedKwhEst: number;
    anomalies: number;
  }[];
  halls?: HallSimulationMetrics[];
  anomaliesList?: SimulationAnomalyEvent[];
  recommendationsList?: SimulationRecommendation[];
  dateAlignment?: DateAlignmentInfo;
  modelLimitations?: string[];
  engine: 'mock' | 'ml';
  replayProgress?: ReplayTickData;
}

export interface SimulationJob {
  id: string;
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'done' | 'failed';
  progress: number; // 0 to 1
  stepsCompleted: number;
  stepsTotal: number;
  steps: SimulationStep[];
  summary?: SimulationSummary;
  config: SimulationRunConfig;
  createdAt: string;
  error?: string;
  currentStage?: string;
  replayState?: ReplayTickData;
}