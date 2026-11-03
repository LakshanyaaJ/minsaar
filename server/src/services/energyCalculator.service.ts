export interface EnergyMetrics {
  totalActualKwh: number;
  totalPredictedKwh: number;
  totalOptimizedKwh: number;
  wastedKwhEst: number;
  savingsKwhEst: number;
  savingsInrEst: number;
  savingsPct: number;
  baselineCostInr: number;
  optimizedCostInr: number;
  mae: number;
  rmse: number;
  r2: number;
  comfortCompliancePct: number;
}

export class EnergyCalculatorService {
  /**
   * Energy in kWh = power in kW * duration in hours
   */
  kwh(powerKw: number, durationHours: number): number {
    return Number((powerKw * durationHours).toFixed(4));
  }

  cost(kwhVal: number, tariffInrPerKwh: number): number {
    return Number((kwhVal * tariffInrPerKwh).toFixed(2));
  }

  savings(baselineKwh: number, optimizedKwh: number): number {
    return Number(Math.max(0, baselineKwh - optimizedKwh).toFixed(2));
  }

  costSavings(savingsKwhVal: number, tariffInrPerKwh: number): number {
    return Number((savingsKwhVal * tariffInrPerKwh).toFixed(2));
  }

  calculateSimulationMetrics(
    steps: {
      actualKwh: number;
      predictedKwh: number;
      wastedKwhEst: number;
      tempStatus?: { within: boolean };
    }[],
    tariffInrPerKwh: number
  ): EnergyMetrics {
    let totalActual = 0;
    let totalPredicted = 0;
    let totalWasted = 0;
    let maeSum = 0;
    let mseSum = 0;
    let withinComfortCount = 0;

    for (const step of steps) {
      totalActual += step.actualKwh;
      totalPredicted += step.predictedKwh;
      totalWasted += step.wastedKwhEst;

      const diff = step.actualKwh - step.predictedKwh;
      maeSum += Math.abs(diff);
      mseSum += diff * diff;

      if (step.tempStatus?.within) {
        withinComfortCount++;
      }
    }

    const n = Math.max(1, steps.length);
    const mae = maeSum / n;
    const rmse = Math.sqrt(mseSum / n);

    // R2 calculation
    const meanActual = totalActual / n;
    let ssTot = 0;
    for (const step of steps) {
      ssTot += Math.pow(step.actualKwh - meanActual, 2);
    }
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - (mseSum / ssTot));

    const totalOptimized = Math.max(0, totalActual - totalWasted);
    const savingsKwh = Number(totalWasted.toFixed(2));
    const savingsInr = this.costSavings(savingsKwh, tariffInrPerKwh);
    const savingsPct = totalActual > 0 ? Number(((savingsKwh / totalActual) * 100).toFixed(1)) : 0;
    const comfortCompliancePct = Number(((withinComfortCount / n) * 100).toFixed(1));

    return {
      totalActualKwh: Number(totalActual.toFixed(2)),
      totalPredictedKwh: Number(totalPredicted.toFixed(2)),
      totalOptimizedKwh: Number(totalOptimized.toFixed(2)),
      wastedKwhEst: savingsKwh,
      savingsKwhEst: savingsKwh,
      savingsInrEst: savingsInr,
      savingsPct,
      baselineCostInr: this.cost(totalActual, tariffInrPerKwh),
      optimizedCostInr: this.cost(totalOptimized, tariffInrPerKwh),
      mae: Number(mae.toFixed(2)),
      rmse: Number(rmse.toFixed(2)),
      r2: Number(r2.toFixed(3)),
      comfortCompliancePct,
    };
  }
}

export const energyCalculator = new EnergyCalculatorService();
