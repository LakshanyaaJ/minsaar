import { z } from 'zod';

export const thresholdSchema = z.object({
  minTempC: z.number().min(16).max(30),
  maxTempC: z.number().min(18).max(34),
}).refine(data => data.minTempC < data.maxTempC, {
  message: 'minTempC must be strictly less than maxTempC',
  path: ['maxTempC'],
});

export const setpointSchema = z.object({
  setpointC: z.number().min(16).max(30),
});
