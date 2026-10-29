export interface ServerEvent {
  type:
    | 'reading'
    | 'anomaly'
    | 'recommendation'
    | 'command'
    | 'simulation_progress'
    | 'simulation_complete'
    | 'simulation_replay_tick'
    | 'simulation_replay_status';
  data: any;
  timestamp: string;
}
