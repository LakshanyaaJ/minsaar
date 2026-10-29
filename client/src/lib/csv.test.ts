import { describe, it, expect } from 'vitest';
import { validateReadingsCsv, validateScheduleCsv, generateSampleReadingsCsv } from './csv';

describe('CSV Validation', () => {
  it('validates a correct sample readings CSV', () => {
    const csv = generateSampleReadingsCsv();
    const result = validateReadingsCsv(csv);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('catches missing required columns', () => {
    const badCsv = "date_time,room\n2026-10-01T00:00:00Z,Lab 1";
    const result = validateReadingsCsv(badCsv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Missing required columns");
  });

  it('validates temperature bounds', () => {
    const csv = "date_time,room,ac_unit_id,power_kw,set_temp_c,room_temp_c,occupancy,on_off_status\n2026-10-01T00:00:00Z,Room1,AC1,2.0,50.0,24.0,1,1";
    const result = validateReadingsCsv(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("set_temp_c out of range");
  });

  it('validates schedules off_time is after on_time', () => {
    const csv = "ac_unit_id,weekday,on_time,off_time,setpoint_c\nAC1,Mon,17:00,09:00,24";
    const result = validateScheduleCsv(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("off_time must be after on_time");
  });
});