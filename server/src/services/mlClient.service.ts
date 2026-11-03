import { env } from '../config/env';

export interface MLAnomalyReading {
  meter_reading: number;
  air_temperature: number;
  dew_temperature: number;
  hour_of_day: number;
  day_of_week: number;
  month: number;
  is_weekend: number;
  square_feet: number;
  timestamp?: string;
  hall_id?: string;
}

export interface MLAnomalyResponse {
  total_readings: number;
  anomaly_count: number;
  anomaly_percentage: number;
  model_version: string;
  source: string;
  results: {
    timestamp?: string;
    hall_id?: string;
    meter_reading: number;
    prediction: number;
    status: string;
    is_anomaly: boolean;
    anomaly_score: number;
  }[];
}

export interface MLForecastRequest {
  building_id: number;
  hall_id?: string;
  forecast_start: string;
  horizon: string | number;
  historical_timestamps: string[];
  historical_readings: number[];
  building_info: {
    square_feet: number;
    primary_use_code: number;
    year_built?: number;
    floor_count?: number;
  };
  weather_forecast?: {
    timestamp: string;
    air_temperature: number;
    dew_temperature: number;
    wind_speed: number;
  }[];
  tariff_per_kwh?: number;
}

export interface MLForecastResponse {
  forecast_start: string;
  forecast_end: string;
  horizon_hours: number;
  building_id: number;
  hall_id?: string;
  units: string;
  total_predicted_energy_kwh: number;
  hourly_predictions: {
    timestamp: string;
    forecast_hour: number;
    predicted_kwh: number;
  }[];
  daily_breakdown?: {
    date: string;
    total_kwh: number;
    mean_hourly_kwh: number;
    min_kwh: number;
    max_kwh: number;
  }[];
  model_version: string;
  source: string;
  disclaimer: string;
}

export class MLClientService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (env.ML_SERVICE_URL || 'http://localhost:5001').replace(/\/+$/, '');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === 'healthy' || data.status === 'degraded';
    } catch {
      return false;
    }
  }

  async detectAnomalies(readings: MLAnomalyReading[]): Promise<MLAnomalyResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/predict/anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readings }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('ML service anomaly prediction failed:', res.status, errorText);
        return null;
      }

      return (await res.json()) as MLAnomalyResponse;
    } catch (err) {
      console.error('ML service anomaly call error:', err);
      return null;
    }
  }

  async generateForecast(request: MLForecastRequest): Promise<MLForecastResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/predict/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('ML service forecast prediction failed:', res.status, errorText);
        return null;
      }

      return (await res.json()) as MLForecastResponse;
    } catch (err) {
      console.error('ML service forecast call error:', err);
      return null;
    }
  }
}

export const mlClient = new MLClientService();
