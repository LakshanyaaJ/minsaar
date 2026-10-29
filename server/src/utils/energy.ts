export const kwh = (avgKw: number, hours: number): number => {
  return Number((avgKw * hours).toFixed(2));
};

export const cost = (kwhVal: number, tariff: number): number => {
  return Number((kwhVal * tariff).toFixed(2));
};

export const savings = (baselineKwh: number, optimizedKwh: number): number => {
  return Number((Math.max(0, baselineKwh - optimizedKwh)).toFixed(2));
};

export const costSavings = (savingsKwh: number, tariff: number): number => {
  return Number((savingsKwh * tariff).toFixed(2));
};