import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Simulation Lifecycle & CSV Processing', () => {
  const sampleReadingsCsv = `timestamp,hall_id,hall_name,building_id,meter,meter_reading,air_temperature,dew_temperature,cloud_coverage,wind_speed,site_id,hour_of_day,day_of_week,month,is_weekend,primary_use,primary_use_code,square_feet,year_built,floor_count,indoor_temperature_c,indoor_relative_humidity_pct,occupancy_count,expected_occupancy,scheduled_open,scheduled_session_id,observed_ac_on,observed_setpoint_c,ac_equipment_type,cooling_capacity_kw,ac_rated_input_kw,rated_cop,compressor_modulation_pct,ac_power_kw,non_ac_power_kw,whole_hall_power_kw,ac_energy_kwh_min,simulated_cooling_effectiveness_pct
2026-11-01 00:00:00,HALL_A,Lecture Hall A,637,0,0.023,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4189,1929,3,27.0,71.96,0,0,0,,0,24.5,Inverter,28.0,8.0,3.5,0.0,0.0,1.4,1.4,0.0,92.3
2026-11-01 01:00:00,HALL_A,Lecture Hall A,637,0,0.023,25.77,22.5,4,2.71,4,1,6,11,1,Education,0,4189,1929,3,27.0,71.96,0,0,0,,0,24.5,Inverter,28.0,8.0,3.5,0.0,0.0,1.4,1.4,0.0,92.3
2026-11-01 02:00:00,HALL_A,Lecture Hall A,637,0,0.035,25.77,22.5,4,2.71,4,2,6,11,1,Education,0,4189,1929,3,21.0,71.96,0,0,0,,1,18.0,Inverter,28.0,8.0,3.5,60.0,2.1,1.4,3.5,0.035,92.3
2026-11-01 00:00:00,HALL_B,Lecture Hall B,637,0,0.040,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4500,1935,3,26.5,70.0,0,0,0,,0,24.0,Inverter,32.0,9.0,3.5,0.0,0.0,1.5,1.5,0.0,91.0
2026-11-01 01:00:00,HALL_B,Lecture Hall B,637,0,0.040,25.77,22.5,4,2.71,4,1,6,11,1,Education,0,4500,1935,3,26.5,70.0,0,0,0,,0,24.0,Inverter,32.0,9.0,3.5,0.0,0.0,1.5,1.5,0.0,91.0
2026-11-01 02:00:00,HALL_B,Lecture Hall B,637,0,0.050,25.77,22.5,4,2.71,4,2,6,11,1,Education,0,4500,1935,3,25.0,70.0,25,30,1,sess_1,1,24.0,Inverter,32.0,9.0,3.5,45.0,1.8,1.5,3.3,0.050,91.0`;

  const sampleScheduleCsv = `session_id,session_date,day_of_week,hall_id,hall_name,schedule_status,start_time,end_time,start_datetime,end_datetime,expected_occupancy,occupancy_capacity,session_type,planned_setpoint_c,priority,extended_hours_flag,schedule_note
HALL_A_20261108_CLOSED,2026-11-08,Sunday,HALL_A,Lecture Hall A,CLOSED,,,,,0,60,Closed / no session,24.5,2,0,No session
HALL_A_20261109_01,2026-11-09,Monday,HALL_A,Lecture Hall A,SCHEDULED,08:30,12:30,2026-11-09 08:30:00,2026-11-09 12:30:00,42,60,Lecture,24.5,2,0,
HALL_B_20261108_CLOSED,2026-11-08,Sunday,HALL_B,Lecture Hall B,CLOSED,,,,,0,60,Closed / no session,24.0,2,0,No session
HALL_B_20261109_01,2026-11-09,Monday,HALL_B,Lecture Hall B,SCHEDULED,09:00,13:00,2026-11-09 09:00:00,2026-11-09 13:00:00,30,60,Lecture,24.0,2,0,`;

  it('rejects simulation creation when files are missing', async () => {
    const res = await request(app)
      .post('/api/simulations')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Both readingsFile and scheduleFile must be provided');
  });

  it('rejects invalid or empty CSV contents', async () => {
    const res = await request(app)
      .post('/api/simulations')
      .attach('readingsFile', Buffer.from('invalid,header\n1,2'), 'bad.csv')
      .attach('scheduleFile', Buffer.from(sampleScheduleCsv), 'schedule.csv');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid readings CSV schema');
  });

  it('creates and executes multi-hall simulation with hall-level metrics and recommendations', async () => {
    const res = await request(app)
      .post('/api/simulations')
      .attach('readingsFile', Buffer.from(sampleReadingsCsv), 'synthetic_demo.csv')
      .attach('scheduleFile', Buffer.from(sampleScheduleCsv), 'weekly_schedule.csv')
      .field('config', JSON.stringify({ intervalHours: 1, tariffInrPerKwh: 8.0, selectedHall: 'ALL' }));

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    const jobId = res.body.id;

    // Poll until completed (or timeout)
    let isDone = false;
    let attempts = 0;
    let jobData: any = null;

    while (!isDone && attempts < 15) {
      await new Promise(r => setTimeout(r, 400));
      const checkRes = await request(app).get(`/api/simulations/${jobId}`);
      jobData = checkRes.body;
      if (jobData.status === 'done' || jobData.status === 'failed') {
        isDone = true;
      }
      attempts++;
    }

    expect(jobData).toBeDefined();
    expect(jobData.status).toBe('done');
    expect(jobData.summary).toBeDefined();

    // Verify hall-level metrics
    const summary = jobData.summary;
    expect(summary.halls).toBeDefined();
    expect(summary.halls.length).toBeGreaterThanOrEqual(2);

    const hallA = summary.halls.find((h: any) => h.hallId === 'HALL_A');
    expect(hallA).toBeDefined();
    expect(hallA.totalActualKwh).toBeGreaterThan(0);
    expect(hallA.savingsInrEst).toBeGreaterThanOrEqual(0);

    const hallB = summary.halls.find((h: any) => h.hallId === 'HALL_B');
    expect(hallB).toBeDefined();
    expect(hallB.totalActualKwh).toBeGreaterThan(0);

    // Verify date alignment info
    expect(summary.dateAlignment).toBeDefined();
    expect(summary.dateAlignment.explanation).toBeDefined();
    expect(summary.modelLimitations).toHaveLength(4);

    // Verify rule-based recommendations
    expect(summary.recommendationsList).toBeDefined();
    if (summary.recommendationsList.length > 0) {
      const firstRec = summary.recommendationsList[0];
      expect(firstRec.status).toBe('Simulated');
      expect(firstRec.reason).toBeDefined();
    }

    // Verify cleanup
    const delRes = await request(app).delete(`/api/simulations/${jobId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });
});
