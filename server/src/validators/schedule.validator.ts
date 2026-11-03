import { z } from 'zod';

export const scheduleUpsertSchema = z.object({
  id: z.string().optional(),
  acUnitId: z.string(),
  weekday: z.number().int().min(0).max(6),
  onTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid onTime format HH:mm'),
  offTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid offTime format HH:mm'),
  setpointC: z.number().min(16).max(32).default(24),
  active: z.boolean().default(true),
  priority: z.number().int().default(1),
});

export const scheduleExceptionSchema = z.object({
  id: z.string().optional(),
  acUnitId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date YYYY-MM-DD'),
  kind: z.enum(['holiday', 'override']),
  note: z.string().optional(),
});

export const bulkScheduleSchema = z.object({
  schedules: z.array(scheduleUpsertSchema),
});
