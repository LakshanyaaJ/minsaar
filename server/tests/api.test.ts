import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/db';

describe('Minsaar API Integration Tests', () => {
  let adminCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    // Perform login for admin and viewer
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@campus.edu', password: 'password123' });

    expect(adminLogin.status).toBe(200);
    adminCookie = adminLogin.headers['set-cookie'][0];

    const viewerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'viewer@campus.edu', password: 'password123' });

    expect(viewerLogin.status).toBe(200);
    viewerCookie = viewerLogin.headers['set-cookie'][0];
  });

  describe('Authentication Endpoints', () => {
    it('GET /api/auth/me returns authenticated user details', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('admin@campus.edu');
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('GET /api/auth/me returns 401 without cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/auth/login rejects invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@campus.edu', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('POST /api/auth/logout clears token cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Buildings, Rooms & AC Units Endpoints', () => {
    it('GET /api/buildings returns array of buildings', async () => {
      const res = await request(app).get('/api/buildings');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/rooms returns array of rooms with temperature thresholds', async () => {
      const res = await request(app).get('/api/rooms');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const hallA = res.body.find((r: any) => r.id === 'HALL_A');
      expect(hallA).toBeDefined();
      expect(hallA.minTempC).toBeDefined();
      expect(hallA.maxTempC).toBeDefined();
    });

    it('GET /api/ac-units returns array of AC units', async () => {
      const res = await request(app).get('/api/ac-units');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/overview returns KPI overview metrics', async () => {
      const res = await request(app).get('/api/overview?range=Today');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalKwh');
      expect(res.body).toHaveProperty('estSavings');
      expect(res.body).toHaveProperty('anomaliesCount');
      expect(res.body).toHaveProperty('unitsActive');
      expect(res.body).toHaveProperty('occupancyRate');
    });
  });

  describe('Schedules Endpoints', () => {
    it('GET /api/schedules returns schedules list', async () => {
      const res = await request(app).get('/api/schedules');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('POST /api/schedules upserts a schedule', async () => {
      const newSchedule = {
        acUnitId: 'ac_HALL_A',
        weekday: 1,
        onTime: '08:00',
        offTime: '17:30',
        setpointC: 24.5,
        active: true,
      };

      const res = await request(app)
        .post('/api/schedules')
        .send(newSchedule);

      expect(res.status).toBe(200);
      expect(res.body.acUnitId).toBe('ac_HALL_A');
      expect(res.body.onTime).toBe('08:00');
    });
  });

  describe('Temperature & Controls Endpoints', () => {
    it('GET /api/rooms/:id/temperature returns current state and bounds', async () => {
      const res = await request(app).get('/api/rooms/HALL_A/temperature');
      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe('HALL_A');
      expect(res.body.minBoundC).toBeDefined();
      expect(res.body.maxBoundC).toBeDefined();
      expect(res.body.indoorTempC).toBeDefined();
    });

    it('PUT /api/rooms/:id/thresholds updates bounds', async () => {
      const res = await request(app)
        .put('/api/rooms/HALL_A/thresholds')
        .send({ minTempC: 22.5, maxTempC: 25.5 });

      expect(res.status).toBe(200);
      expect(res.body.minTempC).toBe(22.5);
      expect(res.body.maxTempC).toBe(25.5);
    });

    it('POST /api/ac-units/:id/setpoint sets command', async () => {
      const res = await request(app)
        .post('/api/ac-units/ac_HALL_A/setpoint')
        .set('Cookie', adminCookie)
        .send({ setpointC: 25.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.setpointC).toBe(25.0);
    });
  });

  describe('Settings Endpoints', () => {
    it('GET /api/settings returns tariff, timezone and mode', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.tariffInrPerKwh).toBeDefined();
      expect(res.body.timezone).toBe('Asia/Kolkata');
      expect(res.body.mode).toBeDefined();
    });

    it('POST /api/settings/tariff updates tariff', async () => {
      const res = await request(app)
        .post('/api/settings/tariff')
        .send({ tariff: 8.5 });

      expect(res.status).toBe(200);
      expect(res.body.tariffInrPerKwh).toBe(8.5);
    });
  });

  describe('Telemetry Ingestion Endpoint', () => {
    it('POST /api/ingest/readings succeeds with valid device key', async () => {
      const res = await request(app)
        .post('/api/ingest/readings')
        .set('x-device-key', 'minsaar-device-secret-key-2026')
        .send([
          {
            acUnitId: 'ac_HALL_A',
            roomId: 'HALL_A',
            timestamp: new Date().toISOString(),
            powerKw: 2.4,
            setTempC: 24.0,
            roomTempC: 23.8,
            occupancy: 35,
            onOff: true,
            outdoorTempC: 29.1,
            dataSource: 'measured',
          },
        ]);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    it('POST /api/ingest/readings rejects with invalid device key', async () => {
      const res = await request(app)
        .post('/api/ingest/readings')
        .set('x-device-key', 'wrong-key')
        .send([]);

      expect(res.status).toBe(401);
    });
  });
});
