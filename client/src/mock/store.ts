import { seedDatabase } from './seed';

class MockStore {
  data = seedDatabase();

  get() {
    return this.data;
  }

  updateSettings(updates: Partial<typeof this.data.settings>) {
    this.data.settings = { ...this.data.settings, ...updates };
  }

  updateRecommendation(id: string, updates: Partial<typeof this.data.recommendations[0]>) {
    this.data.recommendations = this.data.recommendations.map(r => r.id === id ? { ...r, ...updates } : r);
  }

  upsertSchedule(schedule: any) {
    const existingIndex = this.data.schedules.findIndex(s => s.id === schedule.id);
    if (existingIndex > -1) {
      this.data.schedules[existingIndex] = schedule;
    } else {
      this.data.schedules.push(schedule);
    }
  }
}

export const store = new MockStore();