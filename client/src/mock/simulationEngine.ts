import type { SimulationRunConfig, SimulationStep, SimulationSummary } from '../types/simulation';
import type { Anomaly } from '../types/domain';
import { kwh, savings, costSavings } from '../lib/energy';

export class MockSimulationEngine {
  public config: SimulationRunConfig;
  public steps: SimulationStep[] = [];
  public durationHours: number;
  
  constructor(config: SimulationRunConfig, durationHours: number = 168) {
    this.config = config;
    this.durationHours = durationHours;
  }

  public runStep(stepIndex: number): SimulationStep {
    const startHour = stepIndex * this.config.intervalHours;
    // Deterministic mock variables based on stepIndex
    const isDay = (startHour % 24) >= 8 && (startHour % 24) <= 17;
    
    // 1. Predict energy (seasonal naive logic mock)
    const predicted = isDay ? (2.0 * this.config.intervalHours) : 0;
    
    // 2. Actual data
    // Inject a deterministic anomaly every 5th step if it's night
    const hasNightRunAnomaly = !isDay && stepIndex % 5 === 0;
    const actualKw = hasNightRunAnomaly ? 1.5 : (isDay ? 2.2 : 0);
    const actualKwh = kwh(actualKw, this.config.intervalHours);
    
    // 3. Flag anomalies
    const anomalies: Anomaly[] = [];
    let wasted = 0;
    
    if (hasNightRunAnomaly) {
      anomalies.push({
        id: `an_sim_${stepIndex}`,
        acUnitId: 'ac_mock_1',
        ts: new Date().toISOString(),
        category: 'runtime_after_hours',
        severity: 'critical',
        wastedKwhEst: actualKwh,
        observations: ['AC running outside schedule']
      });
      wasted = actualKwh;
    }

    const step: SimulationStep = {
      stepIndex,
      windowStart: `Hour ${startHour}`,
      windowEnd: `Hour ${startHour + this.config.intervalHours}`,
      actualKwh,
      predictedKwh: predicted,
      forecastNextKwh: predicted,
      anomalies,
      wastedKwhEst: wasted,
      outsideScheduleHours: hasNightRunAnomaly,
      tempStatus: { below: false, within: true, above: false },
      recommendationIds: []
    };
    
    this.steps.push(step);
    return step;
  }

  public generateSummary(): SimulationSummary {
    let totalActual = 0;
    let totalPredicted = 0;
    let maeSum = 0;
    let mseSum = 0;
    let totalWasted = 0;
    let anomaliesCount = 0;

    this.steps.forEach(s => {
      totalActual += s.actualKwh;
      totalPredicted += s.predictedKwh;
      const error = s.actualKwh - s.predictedKwh;
      maeSum += Math.abs(error);
      mseSum += (error * error);
      totalWasted += s.wastedKwhEst;
      anomaliesCount += s.anomalies.length;
    });

    const n = Math.max(1, this.steps.length);
    const meanActual = totalActual / n;
    
    let ssTot = 0;
    this.steps.forEach(s => {
      ssTot += Math.pow(s.actualKwh - meanActual, 2);
    });

    const mae = maeSum / n;
    const rmse = Math.sqrt(mseSum / n);
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - (mseSum / ssTot));

    const estSavings = totalWasted;

    return {
      totalActualKwh: Number(totalActual.toFixed(2)),
      totalPredictedKwh: Number(totalPredicted.toFixed(2)),
      mae: Number(mae.toFixed(2)),
      rmse: Number(rmse.toFixed(2)),
      r2: Number(r2.toFixed(3)),
      anomaliesByCategory: { 'runtime_after_hours': anomaliesCount },
      totalAnomalies: anomaliesCount,
      wastedKwhEst: Number(totalWasted.toFixed(2)),
      savingsKwhEst: Number(estSavings.toFixed(2)),
      savingsInrEst: costSavings(estSavings, this.config.tariffInrPerKwh),
      scheduleCompliancePct: 92.5,
      perRoom: [
        { room: 'Mock Room 1', actualKwh: Number(totalActual.toFixed(2)), wastedKwhEst: Number(totalWasted.toFixed(2)), anomalies: anomaliesCount }
      ],
      engine: 'mock'
    };
  }
}