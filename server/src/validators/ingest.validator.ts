import { z } from 'zod';

export const ingestReadingItemSchema = z.object({
  acUnitId: z.string(),
  roomId: z.string().optional(),
  timestamp: z.string().datetime(),
  powerKw: z.number().min(0),
  energyKwh: z.number().min(0).optional(),
  setTempC: z.number().min(10).max(45),
  roomTempC: z.number().min(10).max(50),
  occupancy: z.number().min(0),
  onOff: z.boolean(),
  outdoorTempC: z.number().optional(),
  dataSource: z.enum(['measured', 'simulated', 'predicted', 'estimated', 'uploaded']).default('measured'),
});

export const ingestBatchSchema = z.object({
  readings: z.array(ingestReadingItemSchema).min(1).max(1000),
});
