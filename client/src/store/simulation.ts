import { create } from 'zustand';
import type { ReplaySpeed } from '../types/simulation';

interface SimulationDraftState {
  readingsFile: File | null;
  scheduleFile: File | null;
  intervalHours: number;
  tariff: number;
  selectedHall: string; // 'ALL' or hallId
  optimizationPolicy: 'balanced' | 'aggressive' | 'comfort';
  mode: 'batch' | 'replay';
  replaySpeed: ReplaySpeed;
  setDraft: (updates: Partial<SimulationDraftState>) => void;
  resetDraft: () => void;
}

export const useSimulationStore = create<SimulationDraftState>((set) => ({
  readingsFile: null,
  scheduleFile: null,
  intervalHours: 24,
  tariff: 8.0,
  selectedHall: 'ALL',
  optimizationPolicy: 'balanced',
  mode: 'batch',
  replaySpeed: '60x',
  setDraft: (updates) => set((state) => ({ ...state, ...updates })),
  resetDraft: () =>
    set({
      readingsFile: null,
      scheduleFile: null,
      intervalHours: 24,
      tariff: 8.0,
      selectedHall: 'ALL',
      optimizationPolicy: 'balanced',
      mode: 'batch',
      replaySpeed: '60x',
    }),
}));