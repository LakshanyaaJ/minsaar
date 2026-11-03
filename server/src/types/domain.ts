export type DataSource = 'measured' | 'simulated' | 'predicted' | 'estimated' | 'uploaded';

export interface OverviewMetrics {
  totalKwh: number;
  estSavings: number;
  anomaliesCount: number;
  unitsActive: number;
  occupancyRate: number;
}

export interface ControlDecision {
  acUnitId: string;
  hallId?: string;
  timestamp: string;
  command: 'ON' | 'OFF' | 'SETPOINT';
  targetSetpointC?: number;
  compressorModulationPct?: number;
  reason: string;
  scheduledOpen: boolean;
  occupancyCount: number;
  indoorTempC: number;
  anomalyDetected: boolean;
  plannedOrSent: 'planned' | 'sent';
  source: DataSource;
}
