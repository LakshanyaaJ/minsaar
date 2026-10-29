import { z } from 'zod';

export const tariffSchema = z.object({
  tariff: z.number().positive(),
});

export const systemModeSchema = z.object({
  mode: z.enum(['simulation', 'live']),
});
