import { ControlDecision } from '../types/domain';

export interface HallStateInput {
  hallId: string;
  acUnitId: string;
  timestamp: string;
  indoorTempC: number;
  outdoorTempC?: number;
  occupancyCount: number;
  expectedOccupancy: number;
  scheduledOpen: boolean;
  scheduledSessionId?: string;
  observedAcOn: boolean;
  observedSetpointC: number;
  acEquipmentType?: string;
  coolingCapacityKw?: number;
  acRatedInputKw?: number;
  minComfortTempC: number;
  maxComfortTempC: number;
  isAnomaly?: boolean;
  consecutiveEmptyMinutes?: number;
  preCoolMinutesRemaining?: number;
}

export class RuleEngineService {
  private vacancyGraceMinutes = 15;
  private preCoolLeadMinutes = 20;

  evaluate(state: HallStateInput): ControlDecision {
    const {
      hallId,
      acUnitId,
      timestamp,
      indoorTempC,
      occupancyCount,
      scheduledOpen,
      observedAcOn,
      observedSetpointC,
      minComfortTempC,
      maxComfortTempC,
      isAnomaly = false,
      consecutiveEmptyMinutes = 0,
      preCoolMinutesRemaining = 0,
    } = state;

    // Rule 1: Outside Scheduled Hours & Unoccupied with AC ON -> Propose OFF
    if (!scheduledOpen && observedAcOn) {
      if (occupancyCount === 0) {
        return {
          acUnitId,
          hallId,
          timestamp,
          command: 'OFF',
          compressorModulationPct: 0,
          reason: 'Hall is unscheduled and empty while AC was observed ON. Shutdown recommended to eliminate phantom energy waste.',
          scheduledOpen: false,
          occupancyCount,
          indoorTempC,
          anomalyDetected: isAnomaly,
          plannedOrSent: 'planned',
          source: 'simulated',
        };
      } else {
        // Unexpected occupancy after hours -> Keep running but set conservative setpoint
        return {
          acUnitId,
          hallId,
          timestamp,
          command: 'SETPOINT',
          targetSetpointC: Math.max(25.0, observedSetpointC),
          compressorModulationPct: 40,
          reason: 'Unscheduled room with active occupancy detected. Maintaining comfort with moderate setpoint.',
          scheduledOpen: false,
          occupancyCount,
          indoorTempC,
          anomalyDetected: isAnomaly,
          plannedOrSent: 'planned',
          source: 'simulated',
        };
      }
    }

    // Rule 2: Pre-cooling before upcoming scheduled session
    if (!scheduledOpen && !observedAcOn && preCoolMinutesRemaining > 0 && preCoolMinutesRemaining <= this.preCoolLeadMinutes) {
      if (indoorTempC > maxComfortTempC) {
        return {
          acUnitId,
          hallId,
          timestamp,
          command: 'ON',
          targetSetpointC: Math.max(24.0, minComfortTempC),
          compressorModulationPct: 50,
          reason: `Upcoming session starts in ${preCoolMinutesRemaining}m and indoor temperature (${indoorTempC}°C) exceeds ${maxComfortTempC}°C. Initiating gradual pre-cooling.`,
          scheduledOpen: false,
          occupancyCount,
          indoorTempC,
          anomalyDetected: false,
          plannedOrSent: 'planned',
          source: 'simulated',
        };
      }
    }

    // Rule 3: Scheduled Session Operating Logic
    if (scheduledOpen) {
      // 3A: Empty hall during session - apply vacancy grace period
      if (occupancyCount === 0 && consecutiveEmptyMinutes >= this.vacancyGraceMinutes) {
        return {
          acUnitId,
          hallId,
          timestamp,
          command: 'OFF',
          compressorModulationPct: 0,
          reason: `Hall has been vacant for ${consecutiveEmptyMinutes} minutes during scheduled session. Proposing standby OFF.`,
          scheduledOpen: true,
          occupancyCount,
          indoorTempC,
          anomalyDetected: isAnomaly,
          plannedOrSent: 'planned',
          source: 'simulated',
        };
      }

      // 3B: Room is over-cooled (Too cold below comfort band)
      if (indoorTempC < minComfortTempC) {
        const recommendedSetpoint = Math.max(24.0, minComfortTempC + 1.0);
        return {
          acUnitId,
          hallId,
          timestamp,
          command: 'SETPOINT',
          targetSetpointC: recommendedSetpoint,
          compressorModulationPct: 30,
          reason: `Room temperature (${indoorTempC}°C) is below comfort minimum (${minComfortTempC}°C) with setpoint ${observedSetpointC}°C. Raising setpoint to save energy and restore comfort.`,
          scheduledOpen: true,
          occupancyCount,
          indoorTempC,
          anomalyDetected: isAnomaly,
          plannedOrSent: 'planned',
          source: 'simulated',
        };
      }

      // 3C: Room is too warm above comfort band
      if (indoorTempC > maxComfortTempC) {
        const recommendedSetpoint = Math.max(23.0, minComfortTempC);
        return {
          acUnitId,
          hallId,
          timestamp,
          command: observedAcOn ? 'SETPOINT' : 'ON',
          targetSetpointC: recommendedSetpoint,
          compressorModulationPct: 85,
          reason: `Room temperature (${indoorTempC}°C) exceeds maximum comfort threshold (${maxComfortTempC}°C). Increasing cooling modulation to reach target.`,
          scheduledOpen: true,
          occupancyCount,
          indoorTempC,
          anomalyDetected: isAnomaly,
          plannedOrSent: 'planned',
          source: 'simulated',
        };
      }

      // 3D: Room is comfortably within band [minComfortTempC, maxComfortTempC]
      const targetSetpoint = 24.5;
      return {
        acUnitId,
        hallId,
        timestamp,
        command: observedAcOn ? 'SETPOINT' : 'ON',
        targetSetpointC: targetSetpoint,
        compressorModulationPct: 45,
        reason: `Room is within comfort band (${minComfortTempC}-${maxComfortTempC}°C). Maintaining optimal energy-saving modulation.`,
        scheduledOpen: true,
        occupancyCount,
        indoorTempC,
        anomalyDetected: isAnomaly,
        plannedOrSent: 'planned',
        source: 'simulated',
      };
    }

    // Default: Off outside schedule
    return {
      acUnitId,
      hallId,
      timestamp,
      command: 'OFF',
      compressorModulationPct: 0,
      reason: 'No session active; room is off.',
      scheduledOpen: false,
      occupancyCount,
      indoorTempC,
      anomalyDetected: isAnomaly,
      plannedOrSent: 'planned',
      source: 'simulated',
    };
  }
}

export const ruleEngine = new RuleEngineService();
