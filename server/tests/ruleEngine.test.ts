import { describe, it, expect } from 'vitest';
import { ruleEngine } from '../src/services/ruleEngine.service';

describe('Rule Engine Unit Tests', () => {
  const baseState = {
    hallId: 'HALL_A',
    acUnitId: 'ac_HALL_A',
    timestamp: '2026-11-02T10:00:00Z',
    indoorTempC: 24.5,
    outdoorTempC: 29.0,
    occupancyCount: 30,
    expectedOccupancy: 45,
    scheduledOpen: true,
    observedAcOn: true,
    observedSetpointC: 24.0,
    minComfortTempC: 22.0,
    maxComfortTempC: 26.0,
    consecutiveEmptyMinutes: 0,
    preCoolMinutesRemaining: 0,
  };

  it('recommends OFF when AC is running outside scheduled hours in an empty hall', () => {
    const decision = ruleEngine.evaluate({
      ...baseState,
      scheduledOpen: false,
      occupancyCount: 0,
      observedAcOn: true,
    });

    expect(decision.command).toBe('OFF');
    expect(decision.compressorModulationPct).toBe(0);
    expect(decision.reason).toContain('phantom energy waste');
  });

  it('keeps conservative SETPOINT when people are working in an unscheduled hall', () => {
    const decision = ruleEngine.evaluate({
      ...baseState,
      scheduledOpen: false,
      occupancyCount: 15,
      observedAcOn: true,
    });

    expect(decision.command).toBe('SETPOINT');
    expect(decision.targetSetpointC).toBeGreaterThanOrEqual(25.0);
    expect(decision.reason).toContain('Unscheduled room with active occupancy');
  });

  it('initiates pre-cooling before an upcoming session when room is hot', () => {
    const decision = ruleEngine.evaluate({
      ...baseState,
      scheduledOpen: false,
      observedAcOn: false,
      occupancyCount: 0,
      indoorTempC: 28.5,
      preCoolMinutesRemaining: 15,
    });

    expect(decision.command).toBe('ON');
    expect(decision.reason).toContain('Initiating gradual pre-cooling');
  });

  it('enforces vacancy grace period before turning AC off during session', () => {
    // 5 minutes empty: within grace period, should not turn off yet
    const earlyEmpty = ruleEngine.evaluate({
      ...baseState,
      scheduledOpen: true,
      occupancyCount: 0,
      consecutiveEmptyMinutes: 5,
    });
    expect(earlyEmpty.command).not.toBe('OFF');

    // 20 minutes empty: exceeds 15-minute grace period, propose standby OFF
    const prolongedEmpty = ruleEngine.evaluate({
      ...baseState,
      scheduledOpen: true,
      occupancyCount: 0,
      consecutiveEmptyMinutes: 20,
    });
    expect(prolongedEmpty.command).toBe('OFF');
    expect(prolongedEmpty.reason).toContain('vacant for 20 minutes');
  });

  it('raises setpoint when room is over-cooled below comfort minimum', () => {
    const decision = ruleEngine.evaluate({
      ...baseState,
      indoorTempC: 20.5,
      minComfortTempC: 22.0,
      observedSetpointC: 19.0,
    });

    expect(decision.command).toBe('SETPOINT');
    expect(decision.targetSetpointC).toBeGreaterThanOrEqual(24.0);
    expect(decision.reason).toContain('below comfort minimum');
  });

  it('increases cooling when room temperature exceeds comfort maximum', () => {
    const decision = ruleEngine.evaluate({
      ...baseState,
      indoorTempC: 27.8,
      maxComfortTempC: 26.0,
    });

    expect(decision.command).toBe('SETPOINT');
    expect(decision.compressorModulationPct).toBe(85);
    expect(decision.reason).toContain('exceeds maximum comfort threshold');
  });

  it('maintains optimal setpoint when within comfort band', () => {
    const decision = ruleEngine.evaluate({
      ...baseState,
      indoorTempC: 24.2,
      minComfortTempC: 22.0,
      maxComfortTempC: 26.0,
    });

    expect(decision.command).toBe('SETPOINT');
    expect(decision.targetSetpointC).toBe(24.5);
    expect(decision.compressorModulationPct).toBe(45);
  });
});
