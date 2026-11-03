import { describe, it, expect } from 'vitest';
import { validateReadingsCsv, validateScheduleCsv, generateSampleReadingsCsv, generateSampleScheduleCsv } from './csv';
import { cost, savings, costSavings } from './energy';

describe('Simulation Workbench & Validation Tests', () => {
  it('validates 5-hall benchmark synthetic readings with date ranges and metadata', () => {
    const csv = `${generateSampleReadingsCsv()}
2026-11-01 00:00:00,HALL_B,Lecture Hall B,637,0,0.035,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4500,1935,3,26.0,70.0,0,0,0,,0,24.0,Inverter,32.0,9.0,3.5,0.0,0.0,1.5,1.5,0.0,91.0`;

    const res = validateReadingsCsv(csv);
    expect(res.valid).toBe(true);
    expect(res.metadata.hallCount).toBe(2);
    expect(res.metadata.halls).toContain('HALL_A');
    expect(res.metadata.halls).toContain('HALL_B');
    expect(res.metadata.startDateStr).toBeDefined();
    expect(res.errors).toHaveLength(0);
  });

  it('validates benchmark weekly schedule schema and computes session counts', () => {
    const csv = generateSampleScheduleCsv();
    const res = validateScheduleCsv(csv);

    expect(res.valid).toBe(true);
    expect(res.metadata.scheduledSessions).toBe(1);
    expect(res.metadata.closedDays).toBe(1);
    expect(res.metadata.hallsCovered).toContain('HALL_A');
  });

  it('correctly compares baseline vs optimized energy and cost savings', () => {
    const baselineKwh = 1000;
    const optimizedKwh = 750;
    const tariff = 8.0;

    const savingsKwh = savings(baselineKwh, optimizedKwh);
    expect(savingsKwh).toBe(250);

    const savingsCost = costSavings(savingsKwh, tariff);
    expect(savingsCost).toBe(2000);

    const baselineCost = cost(baselineKwh, tariff);
    expect(baselineCost).toBe(8000);
  });

  it('ensures zero savings when optimized equals baseline or baseline is lower', () => {
    expect(savings(500, 500)).toBe(0);
    expect(savings(400, 500)).toBe(0);
  });

  it('detects timeline differences between historical telemetry and forward schedule', () => {
    const readingsRes = validateReadingsCsv(generateSampleReadingsCsv());
    const scheduleRes = validateScheduleCsv(generateSampleScheduleCsv());

    expect(readingsRes.valid).toBe(true);
    expect(scheduleRes.valid).toBe(true);

    const readingsStart = readingsRes.metadata.startDateStr || '';
    const schedStart = scheduleRes.metadata.startDateStr || '';

    // Readings start at 2026-11-01, schedule starts at 2026-11-08
    expect(readingsStart).toContain('2026-11-01');
    expect(schedStart).toContain('2026-11-08');
  });
});
