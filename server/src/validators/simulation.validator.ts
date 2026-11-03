import { z } from 'zod';

export const simulationConfigSchema = z.object({
  intervalHours: z.number().int().min(1).max(168).default(1),
  tariffInrPerKwh: z.number().positive().default(8.0),
});
