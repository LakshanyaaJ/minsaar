import Papa from 'papaparse';
import { simulationRepository } from '../repositories/simulation.repository';
import { roomRepository } from '../repositories/room.repository';
import { settingRepository } from '../repositories/setting.repository';
import { mlClient, MLAnomalyReading } from './mlClient.service';
import { ruleEngine } from './ruleEngine.service';
import { energyCalculator } from './energyCalculator.service';
import { eventBus } from './eventBus.service';
import { BadRequest, NotFound } from '../utils/errors';
import { replayEngine } from './replayEngine.service';
import {
  SimulationRunConfig,
  SimulationStepData,
  SimulationSummaryData,
  HallSimulationMetrics,
  SimulationAnomalyEvent,
  SimulationRecommendation,
  DateAlignmentInfo,
  ReplaySpeed,
} from '../types/simulation';

export class SimulationService {
  /**
   * Validate uploaded CSV files server-side and extract timeline details
   */
  validateInputs(readingsContent: string, scheduleContent: string): {
    readings: any[];
    schedules: any[];
    dateAlignment: DateAlignmentInfo;
  } {
    if (!readingsContent || !readingsContent.trim()) {
      throw new BadRequest('Telemetry readings CSV file is empty');
    }
    if (!scheduleContent || !scheduleContent.trim()) {
      throw new BadRequest('Weekly schedule CSV file is empty');
    }

    // 1. Parse readings CSV
    const parsedReadings = Papa.parse(readingsContent, { header: true, skipEmptyLines: true });
    if (parsedReadings.errors.length > 0 && parsedReadings.data.length === 0) {
      throw new BadRequest(`Readings CSV parsing error: ${parsedReadings.errors[0]?.message}`);
    }

    const readingsRows = parsedReadings.data as any[];
    if (readingsRows.length === 0) {
      throw new BadRequest('Readings CSV has no data rows');
    }

    const firstReading = readingsRows[0];
    const isSyntheticFormat =
      'hall_id' in firstReading &&
      ('meter_reading' in firstReading || 'whole_hall_power_kw' in firstReading);
    const isLegacyFormat = 'ac_unit_id' in firstReading && 'power_kw' in firstReading;

    if (!isSyntheticFormat && !isLegacyFormat) {
      throw new BadRequest(
        'Invalid readings CSV schema. Expected columns: timestamp, hall_id, meter_reading, whole_hall_power_kw, indoor_temperature_c, occupancy_count, etc.'
      );
    }

    // 2. Parse schedule CSV
    const parsedSchedule = Papa.parse(scheduleContent, { header: true, skipEmptyLines: true });
    if (parsedSchedule.errors.length > 0 && parsedSchedule.data.length === 0) {
      throw new BadRequest(`Schedule CSV parsing error: ${parsedSchedule.errors[0]?.message}`);
    }

    const scheduleRows = parsedSchedule.data as any[];
    if (scheduleRows.length === 0) {
      throw new BadRequest('Schedule CSV has no data rows');
    }

    // 3. Inspect timestamps for Date Alignment
    let readingsMin = Infinity;
    let readingsMax = -Infinity;
    for (const r of readingsRows) {
      const ts = r.timestamp || r.date_time;
      if (ts) {
        const time = new Date(ts).getTime();
        if (!isNaN(time)) {
          if (time < readingsMin) readingsMin = time;
          if (time > readingsMax) readingsMax = time;
        }
      }
    }

    let schedMin = Infinity;
    let schedMax = -Infinity;
    for (const s of scheduleRows) {
      const ts = s.start_datetime || s.session_date;
      if (ts) {
        const time = new Date(ts).getTime();
        if (!isNaN(time)) {
          if (time < schedMin) schedMin = time;
          if (time > schedMax) schedMax = time;
        }
      }
    }

    const readingsStartDate = readingsMin !== Infinity ? new Date(readingsMin).toISOString().split('T')[0] : 'N/A';
    const readingsEndDate = readingsMax !== -Infinity ? new Date(readingsMax).toISOString().split('T')[0] : 'N/A';
    const readingsDays = readingsMin !== Infinity && readingsMax !== -Infinity
      ? Number(((readingsMax - readingsMin) / (1000 * 3600 * 24)).toFixed(1))
      : 0;

    const schedStartDate = schedMin !== Infinity ? new Date(schedMin).toISOString().split('T')[0] : 'N/A';
    const schedEndDate = schedMax !== -Infinity ? new Date(schedMax).toISOString().split('T')[0] : 'N/A';
    const schedDays = schedMin !== Infinity && schedMax !== -Infinity
      ? Number(((schedMax - schedMin) / (1000 * 3600 * 24)).toFixed(1))
      : 0;

    const isAligned = readingsMin !== Infinity && schedMin !== Infinity && Math.abs(readingsMin - schedMin) < 86400000;
    const explanation = isAligned
      ? 'Readings and schedule timestamps align directly in time.'
      : `Telemetry spans ${readingsStartDate} to ${readingsEndDate} (${readingsDays}d) for historical replay and model warm-up. Schedule spans ${schedStartDate} to ${schedEndDate} (${schedDays}d) for forward planning. Embedded historical schedule flags (scheduled_open) in the telemetry file are used for historical rule evaluation.`;

    const dateAlignment: DateAlignmentInfo = {
      readingsRange: { start: readingsStartDate, end: readingsEndDate, durationDays: readingsDays },
      scheduleRange: { start: schedStartDate, end: schedEndDate, durationDays: schedDays },
      isAligned,
      explanation,
    };

    return {
      readings: readingsRows,
      schedules: scheduleRows,
      dateAlignment,
    };
  }

  async createSimulation(
    userId: string | undefined,
    readingsContent: string,
    scheduleContent: string,
    config: SimulationRunConfig,
    readingsFilename = 'synthetic_demo.csv',
    scheduleFilename = 'weekly_schedule.csv'
  ): Promise<{ id: string }> {
    // 1. Validate inputs and date alignment
    const { readings, schedules, dateAlignment } = this.validateInputs(readingsContent, scheduleContent);

    // 2. Fetch current tariff from settings if not explicitly passed
    let tariff = config.tariffInrPerKwh;
    if (!tariff || tariff <= 0) {
      const setting = await settingRepository.get('tariff');
      tariff = setting?.tariffInrPerKwh ?? 8.0;
    }

    const isReplay = config.mode === 'replay';
    const runConfig: SimulationRunConfig = {
      intervalHours: config.intervalHours || 1,
      tariffInrPerKwh: tariff,
      selectedHall: config.selectedHall || 'ALL',
      optimizationPolicy: config.optimizationPolicy || 'balanced',
      mode: isReplay ? 'replay' : 'batch',
      speed: config.speed || '60x',
      presentationIntervalMs: config.presentationIntervalMs || 200,
    };

    // 3. Create Simulation Job in DB
    const intervalMinutes = runConfig.intervalHours * 60;
    const job = await simulationRepository.createJob({
      userId,
      status: 'queued',
      progress: 0.0,
      stepsCompleted: 0,
      stepsTotal: isReplay ? 10080 : Math.max(1, Math.floor(readings.length / (5 * intervalMinutes))),
      config: runConfig as any,
      readingsFilename,
      scheduleFilename,
    });

    // 4. Trigger asynchronous processing
    if (isReplay) {
      setImmediate(() => {
        replayEngine.startReplay(job.id, readings, schedules, runConfig).catch(err => {
          console.error(`Replay job ${job.id} failed:`, err);
        });
      });
    } else {
      setImmediate(() => {
        this.executeSimulationJob(job.id, readings, schedules, runConfig, dateAlignment).catch(err => {
          console.error(`Simulation job ${job.id} failed:`, err);
        });
      });
    }

    return { id: job.id };
  }

  private async executeSimulationJob(
    jobId: string,
    rawReadings: any[],
    rawSchedules: any[],
    config: SimulationRunConfig,
    dateAlignment: DateAlignmentInfo
  ): Promise<void> {
    try {
      await simulationRepository.updateJob(jobId, { status: 'running', progress: 0.05 });
      eventBus.emitEvent({
        type: 'simulation_progress',
        data: { jobId, status: 'running', progress: 0.05, stage: 'Preparing hall-level telemetry' },
        timestamp: new Date().toISOString(),
      });

      // Group readings by hall
      const hallGroups = new Map<string, any[]>();
      for (const row of rawReadings) {
        const hallId = row.hall_id || row.room || 'HALL_A';
        if (!hallGroups.has(hallId)) hallGroups.set(hallId, []);
        hallGroups.get(hallId)!.push(row);
      }

      // Filter to selected hall if requested and exists
      const allHallIds = Array.from(hallGroups.keys());
      const targetHallIds =
        config.selectedHall && config.selectedHall !== 'ALL' && hallGroups.has(config.selectedHall)
          ? [config.selectedHall]
          : allHallIds;

      // Pre-fetch room thresholds
      const rooms = await roomRepository.findAll();
      const roomThresholdMap = new Map<string, any>(rooms.map((r: any) => [r.id, r]));

      // Check ML service health
      const isMlReady = await mlClient.isHealthy();
      const engineMode: 'ml' | 'mock' = isMlReady ? 'ml' : 'mock';

      const intervalMinutes = config.intervalHours * 60;
      // Step count is based on the primary hall duration
      const primaryReadings = hallGroups.get(targetHallIds[0]) || [];
      const totalSteps = Math.max(1, Math.floor(primaryReadings.length / intervalMinutes));

      // Update total steps in job
      await simulationRepository.updateJob(jobId, { stepsTotal: totalSteps });

      // Pre-aggregate hourly readings for Model 1 batch inference if ML is ready
      const mlAnomalyMap = new Map<string, boolean>();
      if (isMlReady) {
        eventBus.emitEvent({
          type: 'simulation_progress',
          data: { jobId, status: 'running', progress: 0.1, stage: 'Running energy forecasts & ML models' },
          timestamp: new Date().toISOString(),
        });

        const mlBatchReadings: MLAnomalyReading[] = [];
        for (const hallId of targetHallIds) {
          const hallRows = hallGroups.get(hallId) || [];
          const hallStepCount = Math.floor(hallRows.length / intervalMinutes);
          for (let s = 0; s < hallStepCount; s++) {
            const chunk = hallRows.slice(s * intervalMinutes, (s + 1) * intervalMinutes);
            if (chunk.length === 0) continue;
            let sumKwh = 0;
            let sumOutdoor = 0;
            let sumDew = 0;
            for (const r of chunk) {
              const minEnergy = parseFloat(r.meter_reading || r.ac_energy_kwh_min || '0');
              const powerKw = parseFloat(r.whole_hall_power_kw || r.power_kw || '0');
              sumKwh += minEnergy > 0 ? minEnergy : powerKw / 60;
              sumOutdoor += parseFloat(r.air_temperature || r.outdoor_temp_c || '28');
              sumDew += parseFloat(r.dew_temperature || '18');
            }
            const count = chunk.length;
            const firstR = chunk[0];
            const date = new Date(firstR.timestamp || firstR.date_time);
            const hourOfDay = isNaN(date.getUTCHours()) ? (s * config.intervalHours) % 24 : date.getUTCHours();
            const dayOfWeek = isNaN(date.getUTCDay()) ? 1 : date.getUTCDay();
            const month = isNaN(date.getUTCMonth()) ? 11 : date.getUTCMonth() + 1;

            mlBatchReadings.push({
              hall_id: hallId,
              timestamp: firstR.timestamp || firstR.date_time || `step_${s}`,
              meter_reading: Number(sumKwh.toFixed(3)),
              air_temperature: Number((sumOutdoor / count).toFixed(2)),
              dew_temperature: Number((sumDew / count).toFixed(2)),
              hour_of_day: hourOfDay,
              day_of_week: dayOfWeek,
              month,
              is_weekend: [0, 6].includes(dayOfWeek) ? 1 : 0,
              square_feet: parseFloat(firstR.square_feet || '4000'),
            });
          }
        }

        if (mlBatchReadings.length > 0) {
          const mlRes = await mlClient.detectAnomalies(mlBatchReadings);
          if (mlRes && mlRes.results) {
            for (const resItem of mlRes.results) {
              if (resItem.hall_id && resItem.timestamp) {
                mlAnomalyMap.set(`${resItem.hall_id}_${resItem.timestamp}`, resItem.is_anomaly);
              }
            }
          }
        }
      }

      eventBus.emitEvent({
        type: 'simulation_progress',
        data: { jobId, status: 'running', progress: 0.25, stage: 'Evaluating AC control rules & hall optimization' },
        timestamp: new Date().toISOString(),
      });

      // Data structures for results
      const stepsData: SimulationStepData[] = [];
      const anomaliesByCategory: Record<string, number> = {
        runtime_after_hours: 0,
        setpoint_too_low: 0,
        excessive_power: 0,
        phantom_run: 0,
        model_outlier: 0,
      };

      const anomaliesList: SimulationAnomalyEvent[] = [];
      const recommendationsList: SimulationRecommendation[] = [];

      // Per-hall accumulators
      const hallStatsMap = new Map<
        string,
        {
          hallId: string;
          hallName: string;
          totalActualKwh: number;
          totalPredictedKwh: number;
          totalWastedKwh: number;
          occupiedMinutes: number;
          unoccupiedMinutes: number;
          acRuntimeMinutes: number;
          tempSum: number;
          tempMin: number;
          tempMax: number;
          tempCount: number;
          mlAnomalies: number;
          ruleAnomalies: number;
          withinComfortSteps: number;
          totalSteps: number;
          maeSum: number;
          mseSum: number;
        }
      >();

      for (const hId of targetHallIds) {
        const rows = hallGroups.get(hId) || [];
        const firstR = rows[0] || {};
        hallStatsMap.set(hId, {
          hallId: hId,
          hallName: firstR.hall_name || firstR.room || hId,
          totalActualKwh: 0,
          totalPredictedKwh: 0,
          totalWastedKwh: 0,
          occupiedMinutes: 0,
          unoccupiedMinutes: 0,
          acRuntimeMinutes: 0,
          tempSum: 0,
          tempMin: Infinity,
          tempMax: -Infinity,
          tempCount: 0,
          mlAnomalies: 0,
          ruleAnomalies: 0,
          withinComfortSteps: 0,
          totalSteps: 0,
          maeSum: 0,
          mseSum: 0,
        });
      }

      // Step-by-step evaluation
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        const startIdx = stepIdx * intervalMinutes;
        const endIdx = startIdx + intervalMinutes;

        let stepActualKwh = 0;
        let stepPredictedKwh = 0;
        let stepWastedKwh = 0;
        let stepOutsideSchedule = false;
        const stepAnomalies: any[] = [];
        const stepRecIds: string[] = [];

        let windowStartStr = '';
        let windowEndStr = '';
        const byHallStepData: Record<string, any> = {};

        // Evaluate each hall in this step window
        for (const hallId of targetHallIds) {
          const hallRows = hallGroups.get(hallId) || [];
          const chunk = hallRows.slice(startIdx, endIdx);
          if (chunk.length === 0) continue;

          const firstRow = chunk[0];
          const lastRow = chunk[chunk.length - 1];
          if (!windowStartStr) {
            windowStartStr = firstRow.timestamp || firstRow.date_time || `Hour ${stepIdx * config.intervalHours}`;
            windowEndStr = lastRow.timestamp || lastRow.date_time || `Hour ${(stepIdx + 1) * config.intervalHours}`;
          }

          let hallActualKwh = 0;
          let hallAvgIndoor = 0;
          let hallAvgOutdoor = 0;
          let hallAvgOcc = 0;
          let hallAnyAcOn = false;
          let hallScheduledOpen = false;

          for (const r of chunk) {
            const minEnergy = parseFloat(r.meter_reading || r.ac_energy_kwh_min || '0');
            const powerKw = parseFloat(r.whole_hall_power_kw || r.power_kw || '0');
            hallActualKwh += minEnergy > 0 ? minEnergy : powerKw / 60;

            const inTemp = parseFloat(r.indoor_temperature_c || r.room_temp_c || '24');
            hallAvgIndoor += inTemp;
            hallAvgOutdoor += parseFloat(r.air_temperature || r.outdoor_temp_c || '28');
            const occ = parseFloat(r.occupancy_count || r.occupancy || '0');
            hallAvgOcc += occ;

            const acOn = r.observed_ac_on === '1' || r.on_off_status === '1' || r.observed_ac_on === true;
            if (acOn) {
              hallAnyAcOn = true;
            }

            const schedOpen = r.scheduled_open === '1' || r.scheduled_open === true;
            if (schedOpen) {
              hallScheduledOpen = true;
            }

            // Hall stats updates
            const stats = hallStatsMap.get(hallId)!;
            if (occ > 0) stats.occupiedMinutes++;
            else stats.unoccupiedMinutes++;
            if (acOn) stats.acRuntimeMinutes++;
            stats.tempSum += inTemp;
            if (inTemp < stats.tempMin) stats.tempMin = inTemp;
            if (inTemp > stats.tempMax) stats.tempMax = inTemp;
            stats.tempCount++;
          }

          const count = chunk.length;
          hallAvgIndoor = hallAvgIndoor / count;
          hallAvgOutdoor = hallAvgOutdoor / count;
          hallAvgOcc = hallAvgOcc / count;
          hallActualKwh = Number(hallActualKwh.toFixed(3));

          // Predicted energy baseline for this hall & hour
          const hourOfDay = (stepIdx * config.intervalHours) % 24;
          const isDayTime = hourOfDay >= 8 && hourOfDay <= 18;
          const hallPredictedKwh = isDayTime
            ? Number((1.8 * config.intervalHours * (parseFloat(firstRow.square_feet || '4000') / 4000)).toFixed(2))
            : 0.05;

          // Anomaly checks
          const mlKey = `${hallId}_${firstRow.timestamp || firstRow.date_time}`;
          const isMLAnomaly = mlAnomalyMap.get(mlKey) || false;

          const threshold = roomThresholdMap.get(hallId);
          let minComfort = threshold?.minTempC ?? 22.0;
          let maxComfort = threshold?.maxTempC ?? 26.0;

          // Adjust comfort band slightly if user selected custom policy
          if (config.optimizationPolicy === 'aggressive') {
            minComfort = 23.0; // Higher setpoint allowable
            maxComfort = 27.0;
          } else if (config.optimizationPolicy === 'comfort') {
            minComfort = 21.5;
            maxComfort = 24.5;
          }

          // Rule Engine evaluation
          const controlDecision = ruleEngine.evaluate({
            hallId,
            acUnitId: `ac_${hallId}`,
            timestamp: windowStartStr,
            indoorTempC: hallAvgIndoor,
            outdoorTempC: hallAvgOutdoor,
            occupancyCount: hallAvgOcc,
            expectedOccupancy: parseFloat(firstRow.expected_occupancy || '0'),
            scheduledOpen: hallScheduledOpen,
            observedAcOn: hallAnyAcOn,
            observedSetpointC: parseFloat(firstRow.observed_setpoint_c || firstRow.set_temp_c || '24'),
            minComfortTempC: minComfort,
            maxComfortTempC: maxComfort,
            isAnomaly: isMLAnomaly,
          });

          // Wasted energy and recommendations evaluation
          let hallWastedKwh = 0;
          let isRuleAnomaly = false;

          // Condition 1: Phantom run / after-hours operation
          if (!hallScheduledOpen && hallAnyAcOn && hallAvgOcc === 0) {
            hallWastedKwh += hallActualKwh;
            isRuleAnomaly = true;
            anomaliesByCategory.runtime_after_hours++;

            const anomId = `anom_${jobId}_${hallId}_${stepIdx}_phantom`;
            const anomEvent: SimulationAnomalyEvent = {
              id: anomId,
              hallId,
              hallName: firstRow.hall_name || hallId,
              acUnitId: `ac_${hallId}`,
              timestamp: windowStartStr,
              category: 'runtime_after_hours',
              severity: 'critical',
              detectionMethod: 'rule',
              observedKwh: hallActualKwh,
              expectedKwh: 0.0,
              explanation: `AC unit was active (${hallActualKwh} kWh) outside scheduled operating hours with zero occupancy.`,
              action: 'Shutdown AC unit immediately and verify automated schedule interlock.',
            };
            stepAnomalies.push(anomEvent);
            if (anomaliesList.length < 50) anomaliesList.push(anomEvent);

            const recId = `rec_${jobId}_${hallId}_${stepIdx}_off`;
            stepRecIds.push(recId);
            if (recommendationsList.length < 50) {
              recommendationsList.push({
                id: recId,
                hallId,
                hallName: firstRow.hall_name || hallId,
                acUnitId: `ac_${hallId}`,
                timestamp: windowStartStr,
                currentState: 'ON (Unscheduled)',
                command: 'OFF',
                scheduleContext: 'Unscheduled / Closed',
                occupancy: Math.round(hallAvgOcc),
                indoorTempC: Number(hallAvgIndoor.toFixed(1)),
                comfortThreshold: `${minComfort}-${maxComfort}°C`,
                reason: controlDecision.reason,
                estimatedKwhSavings: hallActualKwh,
                estimatedCostSavings: Number((hallActualKwh * config.tariffInrPerKwh).toFixed(2)),
                status: 'Simulated',
                confidence: 'High (Schedule + Sensor Verified)',
              });
            }
          }

          // Condition 2: Over-cooling setpoint too low
          if (hallScheduledOpen && hallAvgIndoor < minComfort && hallAnyAcOn) {
            const excessWaste = Number((hallActualKwh * 0.18).toFixed(3));
            hallWastedKwh += excessWaste;
            isRuleAnomaly = true;
            anomaliesByCategory.setpoint_too_low++;

            const anomId = `anom_${jobId}_${hallId}_${stepIdx}_overcool`;
            const anomEvent: SimulationAnomalyEvent = {
              id: anomId,
              hallId,
              hallName: firstRow.hall_name || hallId,
              acUnitId: `ac_${hallId}`,
              timestamp: windowStartStr,
              category: 'setpoint_too_low',
              severity: 'medium',
              detectionMethod: 'rule',
              observedKwh: hallActualKwh,
              expectedKwh: Number((hallActualKwh - excessWaste).toFixed(3)),
              explanation: `Hall indoor temperature (${hallAvgIndoor.toFixed(1)}°C) dropped below the ${minComfort}°C minimum threshold, wasting energy on excessive cooling.`,
              action: 'Adjust thermostat setpoint up to 24°C to maintain comfort without over-cooling.',
            };
            stepAnomalies.push(anomEvent);
            if (anomaliesList.length < 50) anomaliesList.push(anomEvent);

            const recId = `rec_${jobId}_${hallId}_${stepIdx}_setpoint`;
            stepRecIds.push(recId);
            if (recommendationsList.length < 50) {
              recommendationsList.push({
                id: recId,
                hallId,
                hallName: firstRow.hall_name || hallId,
                acUnitId: `ac_${hallId}`,
                timestamp: windowStartStr,
                currentState: `ON @ ${firstRow.observed_setpoint_c || '21'}°C`,
                command: 'SETPOINT',
                targetSetpointC: Math.max(24.0, minComfort + 1.0),
                scheduleContext: 'Scheduled Session',
                occupancy: Math.round(hallAvgOcc),
                indoorTempC: Number(hallAvgIndoor.toFixed(1)),
                comfortThreshold: `${minComfort}-${maxComfort}°C`,
                reason: controlDecision.reason,
                estimatedKwhSavings: excessWaste,
                estimatedCostSavings: Number((excessWaste * config.tariffInrPerKwh).toFixed(2)),
                status: 'Simulated',
                confidence: 'High (Thermal Sensor Confirmed)',
              });
            }
          }

          // Condition 3: ML Anomaly Outlier
          if (isMLAnomaly) {
            anomaliesByCategory.model_outlier++;
            const anomId = `anom_${jobId}_${hallId}_${stepIdx}_ml`;
            const anomEvent: SimulationAnomalyEvent = {
              id: anomId,
              hallId,
              hallName: firstRow.hall_name || hallId,
              acUnitId: `ac_${hallId}`,
              timestamp: windowStartStr,
              category: 'model_outlier',
              severity: 'high',
              detectionMethod: 'ml',
              observedKwh: hallActualKwh,
              expectedKwh: hallPredictedKwh,
              explanation: `Isolation Forest flagged consumption pattern (${hallActualKwh} kWh) as statistically anomalous relative to outdoor weather (${hallAvgOutdoor.toFixed(1)}°C) and building parameters.`,
              action: 'Inspect compressor cycling and submeter wiring for electrical faults.',
            };
            stepAnomalies.push(anomEvent);
            if (anomaliesList.length < 50) anomaliesList.push(anomEvent);
          }

          hallWastedKwh = Number(hallWastedKwh.toFixed(3));

          // Update hall cumulative stats
          const stats = hallStatsMap.get(hallId)!;
          stats.totalActualKwh += hallActualKwh;
          stats.totalPredictedKwh += hallPredictedKwh;
          stats.totalWastedKwh += hallWastedKwh;
          stats.totalSteps++;
          if (isMLAnomaly) stats.mlAnomalies++;
          if (isRuleAnomaly) stats.ruleAnomalies++;

          const isComfort = hallAvgIndoor >= minComfort && hallAvgIndoor <= maxComfort;
          if (isComfort) stats.withinComfortSteps++;

          const diff = hallActualKwh - hallPredictedKwh;
          stats.maeSum += Math.abs(diff);
          stats.mseSum += diff * diff;

          // Accumulate step sums
          stepActualKwh += hallActualKwh;
          stepPredictedKwh += hallPredictedKwh;
          stepWastedKwh += hallWastedKwh;
          if (!hallScheduledOpen && hallAnyAcOn) {
            stepOutsideSchedule = true;
          }

          byHallStepData[hallId] = {
            hallId,
            hallName: firstRow.hall_name || hallId,
            actualKwh: hallActualKwh,
            predictedKwh: hallPredictedKwh,
            wastedKwhEst: hallWastedKwh,
            avgIndoorTempC: Number(hallAvgIndoor.toFixed(1)),
            avgOccupancy: Math.round(hallAvgOcc),
            acOn: hallAnyAcOn,
            anomalies: isMLAnomaly || isRuleAnomaly ? [`${hallId}_anomaly`] : [],
          };
        }

        stepActualKwh = Number(stepActualKwh.toFixed(3));
        stepPredictedKwh = Number(stepPredictedKwh.toFixed(3));
        stepWastedKwh = Number(stepWastedKwh.toFixed(3));

        const stepData: SimulationStepData = {
          stepIndex: stepIdx,
          windowStart: windowStartStr,
          windowEnd: windowEndStr,
          actualKwh: stepActualKwh,
          predictedKwh: stepPredictedKwh,
          forecastNextKwh: stepPredictedKwh,
          anomalies: stepAnomalies,
          wastedKwhEst: stepWastedKwh,
          outsideScheduleHours: stepOutsideSchedule,
          tempStatus: {
            below: Object.values(byHallStepData).some((h: any) => h.avgIndoorTempC < 22),
            within: Object.values(byHallStepData).every((h: any) => h.avgIndoorTempC >= 22 && h.avgIndoorTempC <= 26),
            above: Object.values(byHallStepData).some((h: any) => h.avgIndoorTempC > 26),
          },
          recommendationIds: stepRecIds,
          byHall: byHallStepData,
        };

        stepsData.push(stepData);

        // Emit progress periodically
        if (stepIdx % 10 === 0 || stepIdx === totalSteps - 1) {
          const progress = Number((0.25 + 0.65 * ((stepIdx + 1) / totalSteps)).toFixed(2));
          await simulationRepository.updateJob(jobId, {
            stepsCompleted: stepIdx + 1,
            progress,
          });

          eventBus.emitEvent({
            type: 'simulation_progress',
            data: {
              jobId,
              status: 'running',
              stepsCompleted: stepIdx + 1,
              stepsTotal: totalSteps,
              progress,
              stage: `Simulating step ${stepIdx + 1} of ${totalSteps}`,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      eventBus.emitEvent({
        type: 'simulation_progress',
        data: { jobId, status: 'running', progress: 0.92, stage: 'Calculating energy savings & persisting results' },
        timestamp: new Date().toISOString(),
      });

      // Compute HallSimulationMetrics for each hall
      const hallsMetrics: HallSimulationMetrics[] = [];
      let totalMlAnomalies = 0;
      let totalRuleAnomalies = 0;

      for (const [hallId, s] of hallStatsMap.entries()) {
        const nSteps = Math.max(1, s.totalSteps);
        const mae = s.maeSum / nSteps;
        const rmse = Math.sqrt(s.mseSum / nSteps);
        const totalActual = Number(s.totalActualKwh.toFixed(2));
        const totalWasted = Number(s.totalWastedKwh.toFixed(2));
        const totalOptimized = Number(Math.max(0, totalActual - totalWasted).toFixed(2));
        const baselineCost = Number((totalActual * config.tariffInrPerKwh).toFixed(2));
        const optimizedCost = Number((totalOptimized * config.tariffInrPerKwh).toFixed(2));
        const savingsInr = Number((totalWasted * config.tariffInrPerKwh).toFixed(2));
        const savingsPct = totalActual > 0 ? Number(((totalWasted / totalActual) * 100).toFixed(1)) : 0;
        const compliancePct = Number(((s.withinComfortSteps / nSteps) * 100).toFixed(1));

        totalMlAnomalies += s.mlAnomalies;
        totalRuleAnomalies += s.ruleAnomalies;

        hallsMetrics.push({
          hallId,
          hallName: s.hallName,
          totalActualKwh: totalActual,
          totalPredictedKwh: Number(s.totalPredictedKwh.toFixed(2)),
          mae: Number(mae.toFixed(2)),
          rmse: Number(rmse.toFixed(2)),
          occupiedHours: Number((s.occupiedMinutes / 60).toFixed(1)),
          unoccupiedHours: Number((s.unoccupiedMinutes / 60).toFixed(1)),
          acRuntimeHours: Number((s.acRuntimeMinutes / 60).toFixed(1)),
          avgIndoorTempC: s.tempCount > 0 ? Number((s.tempSum / s.tempCount).toFixed(1)) : 24.0,
          minIndoorTempC: s.tempMin !== Infinity ? Number(s.tempMin.toFixed(1)) : 22.0,
          maxIndoorTempC: s.tempMax !== -Infinity ? Number(s.tempMax.toFixed(1)) : 26.0,
          mlAnomaliesCount: s.mlAnomalies,
          ruleAnomaliesCount: s.ruleAnomalies,
          totalAnomalies: s.mlAnomalies + s.ruleAnomalies,
          baselineCostInr: baselineCost,
          optimizedCostInr: optimizedCost,
          savingsKwhEst: totalWasted,
          savingsInrEst: savingsInr,
          savingsPct,
          scheduleCompliancePct: compliancePct,
        });
      }

      // Generate aggregate energy metrics
      const energyMetrics = energyCalculator.calculateSimulationMetrics(stepsData, config.tariffInrPerKwh);

      const summary: SimulationSummaryData = {
        totalActualKwh: energyMetrics.totalActualKwh,
        totalPredictedKwh: energyMetrics.totalPredictedKwh,
        mae: energyMetrics.mae,
        rmse: energyMetrics.rmse,
        r2: energyMetrics.r2,
        anomaliesByCategory,
        totalAnomalies: totalMlAnomalies + totalRuleAnomalies,
        mlAnomaliesCount: totalMlAnomalies,
        ruleAnomaliesCount: totalRuleAnomalies,
        wastedKwhEst: energyMetrics.wastedKwhEst,
        savingsKwhEst: energyMetrics.savingsKwhEst,
        savingsInrEst: energyMetrics.savingsInrEst,
        savingsPct: energyMetrics.savingsPct,
        baselineCostInr: energyMetrics.baselineCostInr,
        optimizedCostInr: energyMetrics.optimizedCostInr,
        scheduleCompliancePct: energyMetrics.comfortCompliancePct,
        perRoom: hallsMetrics.map(h => ({
          room: h.hallName,
          actualKwh: h.totalActualKwh,
          wastedKwhEst: h.savingsKwhEst,
          anomalies: h.totalAnomalies,
        })),
        halls: hallsMetrics,
        anomaliesList,
        recommendationsList,
        dateAlignment,
        modelLimitations: [
          'Forecasting model was trained on building-level ASHRAE Great Energy Predictor III electricity data; individual hall-level predictions are demo proxies.',
          'Model 1 Isolation Forest uses 8 building-level features; minute-level telemetry is aggregated into hourly buckets before inference.',
          'Synthetic demonstration telemetry spans Nov 1–7, 2026; weekly schedule file spans Nov 8–14, 2026.',
          'Simulated savings reflect instantaneous adherence to proposed setpoint adjustments and shutdown rules without mechanical delays.',
        ],
        engine: engineMode,
      };

      // Persist simulation steps to PostgreSQL
      const dbSteps = stepsData.map(s => ({
        jobId,
        stepIndex: s.stepIndex,
        windowStart: s.windowStart,
        windowEnd: s.windowEnd,
        actualKwh: s.actualKwh,
        predictedKwh: s.predictedKwh,
        forecastNextKwh: s.forecastNextKwh,
        anomalies: s.anomalies as any,
        wastedKwhEst: s.wastedKwhEst,
        outsideScheduleHours: s.outsideScheduleHours,
        tempStatus: s.tempStatus as any,
        recommendationIds: s.recommendationIds as any,
        details: { byHall: s.byHall } as any,
      }));

      await simulationRepository.createSteps(dbSteps);

      // Finalize job status in DB
      await simulationRepository.updateJob(jobId, {
        status: 'done',
        progress: 1.0,
        stepsCompleted: stepsData.length,
        summary: summary as any,
      });

      eventBus.emitEvent({
        type: 'simulation_complete',
        data: { jobId, status: 'done', summary },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`Simulation ${jobId} failed with error:`, err);
      await simulationRepository.updateJob(jobId, {
        status: 'failed',
        error: err.message || 'Simulation processing failed',
      });
      eventBus.emitEvent({
        type: 'simulation_complete',
        data: { jobId, status: 'failed', error: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getSimulation(id: string, afterStep?: number) {
    const job = await simulationRepository.findJobById(id, true, afterStep);
    if (!job) {
      throw new NotFound(`Simulation ${id} not found`);
    }

    const activeReplay = replayEngine.getActiveSession(id);
    let replayState: any = undefined;
    if (activeReplay) {
      const progress = Number((activeReplay.currentMinuteIndex / activeReplay.totalMinutes).toFixed(3));
      const elapsedWallClockMs = Date.now() - activeReplay.wallClockStartTime - activeReplay.totalPausedMs;
      const hallsState: Record<string, any> = {};
      for (const [hId, stat] of activeReplay.hallTotals.entries()) {
        hallsState[hId] = {
          hallId: hId,
          hallName: stat.hallName,
          indoorTempC: Number(stat.currentIndoorTempC.toFixed(1)),
          outdoorTempC: Number(stat.currentOutdoorTempC.toFixed(1)),
          occupancy: Math.round(stat.currentOccupancy),
          acOn: stat.currentAcOn,
          setpointC: stat.currentSetpointC,
          powerKw: Number(stat.currentPowerKw.toFixed(2)),
          totalEnergyKwh: Number(stat.totalEnergyKwh.toFixed(2)),
          wastedKwh: Number(stat.totalWastedKwh.toFixed(2)),
          savingsInr: Number((stat.totalWastedKwh * activeReplay.config.tariffInrPerKwh).toFixed(2)),
          coolingEffectivenessPct: stat.coolingEffectivenessPct,
        };
      }
      const curGroup =
        activeReplay.timestampGroups[activeReplay.currentMinuteIndex] || activeReplay.timestampGroups[0];
      replayState = {
        jobId: activeReplay.jobId,
        status: activeReplay.status,
        simulatedTimestamp: curGroup?.timestamp || '2026-11-01 00:00:00',
        currentMinuteIndex: activeReplay.currentMinuteIndex,
        totalMinutes: activeReplay.totalMinutes,
        progress,
        elapsedWallClockMs,
        speed: activeReplay.speed,
        speedMultiplier: activeReplay.speedMultiplier,
        halls: hallsState,
        aggregate: {
          totalEnergyKwh: Number(activeReplay.totalActualKwh.toFixed(2)),
          predictedEnergyKwh: Number((activeReplay.totalActualKwh * 0.95).toFixed(2)),
          wastedEnergyKwh: Number(activeReplay.totalWastedKwh.toFixed(2)),
          savingsInrEst: Number((activeReplay.totalWastedKwh * activeReplay.config.tariffInrPerKwh).toFixed(2)),
          totalAnomalies: activeReplay.mlAnomaliesCount + activeReplay.ruleAnomaliesCount,
          mlAnomaliesCount: activeReplay.mlAnomaliesCount,
          ruleAnomaliesCount: activeReplay.ruleAnomaliesCount,
        },
        latestAnomalies: activeReplay.anomalies.slice(-10),
        latestRecommendations: activeReplay.recommendations.slice(-10),
        forecastStatus:
          activeReplay.currentMinuteIndex >= 10080
            ? 'Model 2 Forecaster Ready (168h context complete)'
            : `Collecting historical context (${Math.floor(activeReplay.currentMinuteIndex / 60)}/168h)`,
      };
    }

    return {
      id: job.id,
      status: activeReplay ? activeReplay.status : job.status,
      progress: activeReplay ? replayState.progress : job.progress,
      stepsCompleted: activeReplay ? activeReplay.currentMinuteIndex : job.stepsCompleted,
      stepsTotal: activeReplay ? activeReplay.totalMinutes : job.stepsTotal,
      steps: job.steps.map(s => ({
        stepIndex: s.stepIndex,
        windowStart: s.windowStart,
        windowEnd: s.windowEnd,
        actualKwh: s.actualKwh,
        predictedKwh: s.predictedKwh,
        forecastNextKwh: s.forecastNextKwh,
        anomalies: s.anomalies,
        wastedKwhEst: s.wastedKwhEst,
        outsideScheduleHours: s.outsideScheduleHours,
        tempStatus: s.tempStatus,
        recommendationIds: s.recommendationIds,
        byHall: (s.details as any)?.byHall,
      })),
      summary: job.summary,
      config: job.config,
      createdAt: job.createdAt.toISOString(),
      error: job.error,
      replayState,
    };
  }

  pauseReplay(id: string) {
    return replayEngine.pauseReplay(id);
  }

  resumeReplay(id: string) {
    return replayEngine.resumeReplay(id);
  }

  stopReplay(id: string) {
    return replayEngine.stopReplay(id);
  }

  setReplaySpeed(id: string, speed: ReplaySpeed) {
    return replayEngine.setSpeed(id, speed);
  }

  seekReplay(id: string, targetMinuteIndex: number) {
    return replayEngine.seekReplay(id, targetMinuteIndex);
  }

  restartReplay(id: string) {
    return replayEngine.restartReplay(id);
  }

  async listSimulations() {
    const jobs = await simulationRepository.listJobs();
    return jobs.map(j => ({
      id: j.id,
      status: j.status,
      progress: j.progress,
      stepsCompleted: j.stepsCompleted,
      stepsTotal: j.stepsTotal,
      steps: [],
      summary: j.summary,
      config: j.config,
      createdAt: j.createdAt.toISOString(),
      error: j.error,
    }));
  }

  async deleteSimulation(id: string) {
    replayEngine.stopReplay(id);
    return simulationRepository.deleteJob(id);
  }
}

export const simulationService = new SimulationService();
