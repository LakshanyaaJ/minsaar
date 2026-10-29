import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { replayEngine } from '../src/services/replayEngine.service';
import type { ReplaySpeed } from '../src/types/simulation';

describe('Fast Live Telemetry Replay Engine & Lifecycle', () => {
  const sampleReadingsCsv = `timestamp,hall_id,hall_name,building_id,meter,meter_reading,air_temperature,dew_temperature,cloud_coverage,wind_speed,site_id,hour_of_day,day_of_week,month,is_weekend,primary_use,primary_use_code,square_feet,year_built,floor_count,indoor_temperature_c,indoor_relative_humidity_pct,occupancy_count,expected_occupancy,scheduled_open,scheduled_session_id,observed_ac_on,observed_setpoint_c,ac_equipment_type,cooling_capacity_kw,ac_rated_input_kw,rated_cop,compressor_modulation_pct,ac_power_kw,non_ac_power_kw,whole_hall_power_kw,ac_energy_kwh_min,simulated_cooling_effectiveness_pct
2026-11-01 00:00:00,HALL_A,Lecture Hall A,637,0,0.023,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4189,1929,3,27.0,71.96,0,0,0,,0,24.5,Inverter,28.0,8.0,3.5,0.0,0.0,1.4,1.4,0.0,92.3
2026-11-01 00:00:00,HALL_B,Lecture Hall B,637,0,0.040,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4500,1935,3,26.5,70.0,0,0,0,,0,24.0,Inverter,32.0,9.0,3.5,0.0,0.0,1.5,1.5,0.0,91.0
2026-11-01 00:01:00,HALL_A,Lecture Hall A,637,0,0.035,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4189,1929,3,21.0,71.96,0,0,0,,1,18.0,Inverter,28.0,8.0,3.5,60.0,2.1,1.4,3.5,0.035,92.3
2026-11-01 00:01:00,HALL_B,Lecture Hall B,637,0,0.050,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4500,1935,3,25.0,70.0,25,30,1,sess_1,1,24.0,Inverter,32.0,9.0,3.5,45.0,1.8,1.5,3.3,0.050,91.0
2026-11-01 00:02:00,HALL_A,Lecture Hall A,637,0,0.023,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4189,1929,3,27.0,71.96,0,0,0,,0,24.5,Inverter,28.0,8.0,3.5,0.0,0.0,1.4,1.4,0.0,92.3
2026-11-01 00:02:00,HALL_B,Lecture Hall B,637,0,0.040,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4500,1935,3,26.5,70.0,0,0,0,,0,24.0,Inverter,32.0,9.0,3.5,0.0,0.0,1.5,1.5,0.0,91.0`;

  const sampleScheduleCsv = `session_id,session_date,day_of_week,hall_id,hall_name,schedule_status,start_time,end_time,start_datetime,end_datetime,expected_occupancy,occupancy_capacity,session_type,planned_setpoint_c,priority,extended_hours_flag,schedule_note
HALL_A_20261108_CLOSED,2026-11-08,Sunday,HALL_A,Lecture Hall A,CLOSED,,,,,0,60,Closed / no session,24.5,2,0,No session
HALL_B_20261108_CLOSED,2026-11-08,Sunday,HALL_B,Lecture Hall B,CLOSED,,,,,0,60,Closed / no session,24.0,2,0,No session`;

  it('groups multiple hall readings by timestamp and preserves chronological order', () => {
    const rawRows = [
      { timestamp: '2026-11-01 00:01:00', hall_id: 'HALL_A' },
      { timestamp: '2026-11-01 00:00:00', hall_id: 'HALL_B' },
      { timestamp: '2026-11-01 00:00:00', hall_id: 'HALL_A' },
      { timestamp: '2026-11-01 00:01:00', hall_id: 'HALL_B' },
    ];

    const groups = replayEngine.prepareTimestampGroups(rawRows);
    expect(groups).toHaveLength(2);
    expect(groups[0].timestamp).toBe('2026-11-01 00:00:00');
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].timestamp).toBe('2026-11-01 00:01:00');
    expect(groups[1].rows).toHaveLength(2);
  });

  it('computes accurate speed multipliers and presentation intervals', () => {
    expect(replayEngine.getSpeedMultiplier('1x')).toBe(1);
    expect(replayEngine.getSpeedMultiplier('10x')).toBe(10);
    expect(replayEngine.getSpeedMultiplier('60x')).toBe(60);
    expect(replayEngine.getSpeedMultiplier('presentation')).toBe(4500);

    // Tick intervals
    expect(replayEngine.getTickIntervalMs('60x')).toBe(1000);
    expect(replayEngine.getTickIntervalMs('presentation')).toBe(200);

    // Presentation mode advances 15 minutes per tick (75 min/sec = ~2.2 minutes for 10,080 minutes)
    expect(replayEngine.getMinutesPerTick('presentation')).toBe(15);
  });

  it('creates replay job and exercises pause, resume, speed change, seek, and stop', async () => {
    // 1. Create a replay job
    const res = await request(app)
      .post('/api/simulations')
      .attach('readingsFile', Buffer.from(sampleReadingsCsv), 'synthetic_demo.csv')
      .attach('scheduleFile', Buffer.from(sampleScheduleCsv), 'weekly_schedule.csv')
      .field('config', JSON.stringify({
        mode: 'replay',
        speed: 'presentation',
        tariffInrPerKwh: 8.0,
        selectedHall: 'ALL',
      }));

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    const jobId = res.body.id;

    // 2. Verify job was created as replay
    const jobRes = await request(app).get(`/api/simulations/${jobId}`);
    expect(jobRes.status).toBe(200);
    expect(jobRes.body.config.mode).toBe('replay');

    // 3. Pause Replay
    const pauseRes = await request(app).post(`/api/simulations/${jobId}/pause`);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.success).toBe(true);

    // 4. Change Speed
    const speedRes = await request(app)
      .post(`/api/simulations/${jobId}/speed`)
      .send({ speed: '60x' });
    expect(speedRes.status).toBe(200);
    expect(speedRes.body.success).toBe(true);

    // 5. Seek to timestamp / minute index
    const seekRes = await request(app)
      .post(`/api/simulations/${jobId}/seek`)
      .send({ targetMinuteIndex: 1 });
    expect(seekRes.status).toBe(200);
    expect(seekRes.body.success).toBe(true);

    // 6. Resume Replay
    const resumeRes = await request(app).post(`/api/simulations/${jobId}/resume`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.success).toBe(true);

    // 7. Restart Replay
    const restartRes = await request(app).post(`/api/simulations/${jobId}/restart`);
    expect(restartRes.status).toBe(200);
    expect(restartRes.body.success).toBe(true);

    // 8. Stop Replay
    const stopRes = await request(app).post(`/api/simulations/${jobId}/stop`);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.success).toBe(true);

    // 9. Cleanup
    await request(app).delete(`/api/simulations/${jobId}`);
  });
});
