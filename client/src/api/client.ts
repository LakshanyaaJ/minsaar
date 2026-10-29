import { store } from '../mock/store';
import type { Building, Room, AcUnit, Schedule, Recommendation, Settings, OverviewMetrics } from '../types/domain';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const API_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = {
  getOverview: async (range: string): Promise<OverviewMetrics> => {
    if (USE_MOCK) {
      await delay(300 + Math.random() * 300);
      const data = store.get();
      // Dummy aggregation for mock response
      return {
        totalKwh: 142.6,
        estSavings: 4250,
        anomaliesCount: data.anomalies.length,
        unitsActive: 12,
        occupancyRate: 68
      };
    }
    return fetch(`${API_URL}/overview?range=${range}`).then(r => r.json());
  },

  getBuildings: async (): Promise<Building[]> => {
    if (USE_MOCK) {
      await delay(300);
      return store.get().buildings;
    }
    return fetch(`${API_URL}/buildings`).then(r => r.json());
  },

  getRooms: async (): Promise<Room[]> => {
    if (USE_MOCK) {
      await delay(300);
      return store.get().rooms;
    }
    return fetch(`${API_URL}/rooms`).then(r => r.json());
  },

  getAcUnits: async (): Promise<AcUnit[]> => {
    if (USE_MOCK) {
      await delay(300);
      return store.get().acUnits;
    }
    return fetch(`${API_URL}/ac-units`).then(r => r.json());
  },

  getSchedules: async (): Promise<Schedule[]> => {
    if (USE_MOCK) {
      await delay(300);
      return store.get().schedules;
    }
    return fetch(`${API_URL}/schedules`).then(r => r.json());
  },

  upsertSchedule: async (schedule: Schedule): Promise<void> => {
    if (USE_MOCK) {
      await delay(400);
      store.upsertSchedule(schedule);
      return;
    }
    return fetch(`${API_URL}/schedules`, { method: 'POST', body: JSON.stringify(schedule) }).then(r => r.json());
  },

  getRecommendations: async (): Promise<Recommendation[]> => {
    if (USE_MOCK) {
      await delay(300);
      return store.get().recommendations;
    }
    return fetch(`${API_URL}/recommendations`).then(r => r.json());
  },

  patchRecommendation: async (id: string, updates: Partial<Recommendation>): Promise<void> => {
    if (USE_MOCK) {
      await delay(300);
      store.updateRecommendation(id, updates);
      return;
    }
    return fetch(`${API_URL}/recommendations/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }).then(r => r.json());
  },

  getSettings: async (): Promise<Settings> => {
    if (USE_MOCK) {
      await delay(300);
      return store.get().settings;
    }
    return fetch(`${API_URL}/settings`).then(r => r.json());
  },

  setTariff: async (tariff: number): Promise<void> => {
    if (USE_MOCK) {
      await delay(300);
      store.updateSettings({ tariffInrPerKwh: tariff });
      return;
    }
    return fetch(`${API_URL}/settings/tariff`, { method: 'POST', body: JSON.stringify({ tariff }) }).then(r => r.json());
  }
};