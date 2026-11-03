import { seedDatabase } from './seed';
import type { SimulationJob, SimulationRunConfig } from '../types/simulation';
import { MockSimulationEngine } from './simulationEngine';

class MockStore {
  data = seedDatabase();
  simulationJobs: Record<string, SimulationJob> = {};

  get() { return this.data; }

  updateSettings(updates: Partial<typeof this.data.settings>) {
    this.data.settings = { ...this.data.settings, ...updates };
  }
  updateRecommendation(id: string, updates: Partial<typeof this.data.recommendations[0]>) {
    this.data.recommendations = this.data.recommendations.map(r => r.id === id ? { ...r, ...updates } : r);
  }
  upsertSchedule(schedule: any) {
    const existingIndex = this.data.schedules.findIndex(s => s.id === schedule.id);
    if (existingIndex > -1) { this.data.schedules[existingIndex] = schedule; } 
    else { this.data.schedules.push(schedule); }
  }

  // --- Simulation Management ---
  createSimulation(config: SimulationRunConfig): string {
    const id = `sim_${Date.now()}`;
    const durationHours = 168; // Mock 1 week duration
    const stepsTotal = Math.ceil(durationHours / config.intervalHours);
    
    this.simulationJobs[id] = {
      id,
      status: 'queued',
      progress: 0,
      stepsCompleted: 0,
      stepsTotal,
      steps: [],
      config,
      createdAt: new Date().toISOString()
    };

    // Kick off background processing
    setTimeout(() => this.processSimulation(id, config, durationHours), 500);
    return id;
  }

  private processSimulation(id: string, config: SimulationRunConfig, durationHours: number) {
    const job = this.simulationJobs[id];
    if (!job) return;
    job.status = 'running';
    
    const engine = new MockSimulationEngine(config, durationHours);
    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < job.stepsTotal) {
        const stepResult = engine.runStep(currentStep);
        job.steps.push(stepResult);
        job.stepsCompleted++;
        job.progress = job.stepsCompleted / job.stepsTotal;
        currentStep++;
      } else {
        clearInterval(interval);
        job.status = 'done';
        job.progress = 1;
        job.summary = engine.generateSummary();
      }
    }, 150); // Fast ticks to complete in ~3-6 seconds depending on steps
  }

  getSimulation(id: string): SimulationJob | undefined {
    return this.simulationJobs[id];
  }

  listSimulations(): SimulationJob[] {
    return Object.values(this.simulationJobs)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }

  deleteSimulation(id: string) {
    delete this.simulationJobs[id];
  }
}

export const store = new MockStore();