export type DataSource = 'measured' | 'simulated' | 'predicted' | 'estimated';

export interface Building {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  buildingId: string;
  name: string;
  roomType: 'computer_lab' | 'classroom' | 'seminar_hall' | 'admin_office';
  minTempC: number;
  maxTempC: number;
}

export interface AcUnit {
  id: string;
  roomId: string;
  ratedKw: number;
  controllable: boolean;
  controlMode: 'recommend_only' | 'relay' | 'ir';
}

export interface Reading {
  acUnitId: string;
  ts: string; // ISO date string
  powerKw: number;
  setTempC: number;
  roomTempC: number;
  occupancy: number; // percentage 0-100
  onOff: boolean;
  outdoorTempC: number;
  dataSource: DataSource;
}

export interface Schedule {
  id: string;
  acUnitId: string;
  weekday: number; // 0-6 (Sun-Sat)
  onTime: string; // "HH:mm"
  offTime: string; // "HH:mm"
  setpointC: number;
  active: boolean;
}

export interface ScheduleException {
  id: string;
  acUnitId: string;
  date: string; // "YYYY-MM-DD"
  kind: 'holiday' | 'override';
  note: string;
}

export interface Anomaly {
  id: string;
  acUnitId: string;
  ts: string;
  category: 'runtime_after_hours' | 'setpoint_too_low' | 'excessive_power' | 'phantom_run';
  severity: 'critical' | 'high' | 'medium' | 'low';
  wastedKwhEst: number;
  observations: string[];
}

export interface Recommendation {
  id: string;
  roomId: string;
  type: 'schedule' | 'temperature' | 'energy';
  priority: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  evidence: string[];
  action: string;
  estKwh: number;
  estCostInr: number;
  confidence: number; // 0-100
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  explanation: string;
}

export interface Settings {
  tariffInrPerKwh: number;
  timezone: string;
  mode: 'simulation' | 'live';
}

export interface OverviewMetrics {
  totalKwh: number;
  estSavings: number;
  anomaliesCount: number;
  unitsActive: number;
  occupancyRate: number;
}