import { describe, it, expect } from 'vitest';
import { kwh, cost, savings, costSavings } from '../src/utils/energy';

describe('Energy Utils', () => {
  it('calculates kWh correctly', () => {
    expect(kwh(2.5, 4)).toBe(10.00);
  });
  it('calculates cost correctly', () => {
    expect(cost(10.5, 8)).toBe(84.00);
  });
  it('calculates savings avoiding negatives', () => {
    expect(savings(150, 100)).toBe(50.00);
    expect(savings(100, 150)).toBe(0.00);
  });
  it('calculates cost savings correctly', () => {
    expect(costSavings(50, 8)).toBe(400.00);
  });
});