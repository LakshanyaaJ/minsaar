import { describe, it, expect } from 'vitest';
import { MockSimulationEngine } from './simulationEngine';

describe('Mock Simulation Engine', () => {
  it('runs deterministically and calculates steps correctly', () => {
    const engine = new MockSimulationEngine({ intervalHours: 24, tariffInrPerKwh: 8.0 }, 168);
    const stepsTotal = Math.ceil(168 / 24);
    
    for(let i=0; i<stepsTotal; i++) {
      engine.runStep(i);
    }
    
    expect(engine.steps.length).toBe(7);
    
    const summary = engine.generateSummary();
    expect(summary.engine).toBe('mock');
    expect(summary.totalActualKwh).toBeGreaterThan(0);
    // R2 should be a valid number between 0 and 1
    expect(summary.r2).toBeGreaterThanOrEqual(0);
    expect(summary.r2).toBeLessThanOrEqual(1);
  });
});