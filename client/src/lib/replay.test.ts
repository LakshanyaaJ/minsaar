import { describe, it, expect } from 'vitest';
import { useSimulationStore } from '../store/simulation';

describe('Client Simulation Store & Replay Mode', () => {
  it('initializes with default batch mode and allows toggling to replay mode', () => {
    const store = useSimulationStore.getState();
    expect(store.mode).toBe('batch');
    expect(store.replaySpeed).toBe('60x');

    store.setDraft({ mode: 'replay' });
    expect(useSimulationStore.getState().mode).toBe('replay');

    store.setDraft({ replaySpeed: 'presentation' });
    expect(useSimulationStore.getState().replaySpeed).toBe('presentation');

    store.resetDraft();
    expect(useSimulationStore.getState().mode).toBe('batch');
    expect(useSimulationStore.getState().replaySpeed).toBe('60x');
  });

  it('supports all required replay playback speeds', () => {
    const validSpeeds = ['1x', '10x', '60x', 'presentation'];
    for (const spd of validSpeeds) {
      useSimulationStore.getState().setDraft({ replaySpeed: spd as any });
      expect(useSimulationStore.getState().replaySpeed).toBe(spd);
    }
  });
});
