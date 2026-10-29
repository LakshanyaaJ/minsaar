import { create } from 'zustand'

interface SimulationDraftState {
  readingsFile: File | null;
  scheduleFile: File | null;
  intervalHours: number;
  tariff: number;
  setDraft: (updates: Partial<SimulationDraftState>) => void;
  resetDraft: () => void;
}

export const useSimulationStore = create<SimulationDraftState>((set) => ({
  readingsFile: null,
  scheduleFile: null,
  intervalHours: 24,
  tariff: 8.0,
  setDraft: (updates) => set((state) => ({ ...state, ...updates })),
  resetDraft: () => set({ readingsFile: null, scheduleFile: null, intervalHours: 24, tariff: 8.0 }),
}))