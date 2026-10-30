import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Minsaar database...');

  // 1. Seed Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@campus.edu' },
    update: {},
    create: {
      email: 'admin@campus.edu',
      name: 'Campus Energy Admin',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@campus.edu' },
    update: {},
    create: {
      email: 'viewer@campus.edu',
      name: 'Faculty Viewer',
      passwordHash,
      role: Role.VIEWER,
    },
  });

  console.log(`Seeded users: ${admin.email}, ${viewer.email}`);

  // 2. Seed Settings
  await prisma.setting.upsert({
    where: { key: 'tariff' },
    update: {},
    create: {
      key: 'tariff',
      value: { tariffInrPerKwh: 8.0 },
    },
  });

  await prisma.setting.upsert({
    where: { key: 'system_mode' },
    update: {},
    create: {
      key: 'system_mode',
      value: { mode: 'simulation' },
    },
  });

  await prisma.setting.upsert({
    where: { key: 'timezone' },
    update: {},
    create: {
      key: 'timezone',
      value: { timezone: 'Asia/Kolkata' },
    },
  });

  // 3. Seed Buildings & Rooms for the 5 benchmark Halls
  const mainAcademicBlock = await prisma.building.upsert({
    where: { id: 'b_academic_a' },
    update: {},
    create: {
      id: 'b_academic_a',
      name: 'Academic Complex',
      siteId: 4,
    },
  });

  const conventionCenter = await prisma.building.upsert({
    where: { id: 'b_convention' },
    update: {},
    create: {
      id: 'b_convention',
      name: 'Convention & Seminar Center',
      siteId: 5,
    },
  });

  // Also seed mock buildings b1, b2, b3 so any legacy UI queries work seamlessly
  const b1 = await prisma.building.upsert({
    where: { id: 'b1' },
    update: {},
    create: { id: 'b1', name: 'CSE Block' },
  });
  const b2 = await prisma.building.upsert({
    where: { id: 'b2' },
    update: {},
    create: { id: 'b2', name: 'Science Block' },
  });
  const b3 = await prisma.building.upsert({
    where: { id: 'b3' },
    update: {},
    create: { id: 'b3', name: 'Admin Block' },
  });

  // 5 Benchmark Halls
  const halls = [
    {
      id: 'HALL_A',
      name: 'Lecture Hall A',
      buildingId: mainAcademicBlock.id,
      roomType: 'classroom',
      minTempC: 23.0,
      maxTempC: 26.0,
      squareFeet: 4189.0,
      acUnit: {
        id: 'ac_HALL_A',
        ratedKw: 8.0,
        coolingCapacityKw: 28.0,
        controlMode: 'ir',
        equipmentType: 'Inverter',
        ratedCop: 3.5,
      },
    },
    {
      id: 'HALL_B',
      name: 'Computer Lab B',
      buildingId: mainAcademicBlock.id,
      roomType: 'computer_lab',
      minTempC: 22.0,
      maxTempC: 25.0,
      squareFeet: 6564.0,
      acUnit: {
        id: 'ac_HALL_B',
        ratedKw: 10.5,
        coolingCapacityKw: 36.0,
        controlMode: 'relay',
        equipmentType: 'Inverter',
        ratedCop: 3.43,
      },
    },
    {
      id: 'HALL_C',
      name: 'Seminar Hall C',
      buildingId: conventionCenter.id,
      roomType: 'seminar_hall',
      minTempC: 23.0,
      maxTempC: 25.0,
      squareFeet: 8730.0,
      acUnit: {
        id: 'ac_HALL_C',
        ratedKw: 13.5,
        coolingCapacityKw: 45.0,
        controlMode: 'ir',
        equipmentType: 'Inverter',
        ratedCop: 3.33,
      },
    },
    {
      id: 'HALL_D',
      name: 'Classroom Hall D',
      buildingId: mainAcademicBlock.id,
      roomType: 'classroom',
      minTempC: 24.0,
      maxTempC: 26.0,
      squareFeet: 4000.0,
      acUnit: {
        id: 'ac_HALL_D',
        ratedKw: 6.5,
        coolingCapacityKw: 22.0,
        controlMode: 'relay',
        equipmentType: 'Fixed-speed',
        ratedCop: 3.38,
      },
    },
    {
      id: 'HALL_E',
      name: 'Auditorium E',
      buildingId: conventionCenter.id,
      roomType: 'seminar_hall',
      minTempC: 22.0,
      maxTempC: 25.0,
      squareFeet: 12000.0,
      acUnit: {
        id: 'ac_HALL_E',
        ratedKw: 20.0,
        coolingCapacityKw: 70.0,
        controlMode: 'ir',
        equipmentType: 'Inverter',
        ratedCop: 3.5,
      },
    },
  ];

  for (const h of halls) {
    const room = await prisma.room.upsert({
      where: { id: h.id },
      update: {},
      create: {
        id: h.id,
        name: h.name,
        buildingId: h.buildingId,
        roomType: h.roomType,
        minTempC: h.minTempC,
        maxTempC: h.maxTempC,
        squareFeet: h.squareFeet,
      },
    });

    const ac = await prisma.acUnit.upsert({
      where: { id: h.acUnit.id },
      update: {},
      create: {
        id: h.acUnit.id,
        roomId: room.id,
        ratedKw: h.acUnit.ratedKw,
        coolingCapacityKw: h.acUnit.coolingCapacityKw,
        controllable: true,
        controlMode: h.acUnit.controlMode,
        equipmentType: h.acUnit.equipmentType,
        ratedCop: h.acUnit.ratedCop,
      },
    });

    // Seed standard weekly schedule for unit
    for (let day = 0; day < 7; day++) {
      const isSunday = day === 0;
      const isSaturday = day === 6;
      await prisma.schedule.upsert({
        where: { id: `sch_${ac.id}_${day}` },
        update: {},
        create: {
          id: `sch_${ac.id}_${day}`,
          acUnitId: ac.id,
          weekday: day,
          onTime: isSunday ? '00:00' : isSaturday ? '09:00' : '08:30',
          offTime: isSunday ? '00:00' : isSaturday ? '13:00' : '17:00',
          setpointC: 24.0,
          active: !isSunday,
          priority: 1,
        },
      });
    }
  }

  // Also seed mock rooms r1 - r14 from client seed
  const mockRooms = [
    { id: 'r1', buildingId: 'b1', name: 'Computer Lab 1', roomType: 'computer_lab', minTempC: 22, maxTempC: 25 },
    { id: 'r2', buildingId: 'b1', name: 'Computer Lab 2', roomType: 'computer_lab', minTempC: 22, maxTempC: 25 },
    { id: 'r3', buildingId: 'b1', name: 'Classroom 101', roomType: 'classroom', minTempC: 24, maxTempC: 26 },
    { id: 'r4', buildingId: 'b1', name: 'Classroom 102', roomType: 'classroom', minTempC: 24, maxTempC: 26 },
    { id: 'r5', buildingId: 'b2', name: 'Seminar Hall', roomType: 'seminar_hall', minTempC: 23, maxTempC: 25 },
    { id: 'r6', buildingId: 'b2', name: 'Physics Lab', roomType: 'classroom', minTempC: 24, maxTempC: 26 },
    { id: 'r7', buildingId: 'b2', name: 'Chemistry Lab', roomType: 'classroom', minTempC: 24, maxTempC: 26 },
    { id: 'r8', buildingId: 'b2', name: 'Classroom 201', roomType: 'classroom', minTempC: 24, maxTempC: 26 },
    { id: 'r9', buildingId: 'b2', name: 'Classroom 202', roomType: 'classroom', minTempC: 24, maxTempC: 26 },
    { id: 'r10', buildingId: 'b3', name: 'Admin Office', roomType: 'admin_office', minTempC: 24, maxTempC: 26 },
    { id: 'r11', buildingId: 'b3', name: 'Principal Office', roomType: 'admin_office', minTempC: 24, maxTempC: 26 },
    { id: 'r12', buildingId: 'b3', name: 'Staff Room A', roomType: 'admin_office', minTempC: 24, maxTempC: 26 },
    { id: 'r13', buildingId: 'b3', name: 'Staff Room B', roomType: 'admin_office', minTempC: 24, maxTempC: 26 },
    { id: 'r14', buildingId: 'b3', name: 'Conference Room', roomType: 'seminar_hall', minTempC: 23, maxTempC: 25 },
  ];

  for (const r of mockRooms) {
    await prisma.room.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        buildingId: r.buildingId,
        name: r.name,
        roomType: r.roomType,
        minTempC: r.minTempC,
        maxTempC: r.maxTempC,
      },
    });

    const acId = `ac_${r.id}_1`;
    await prisma.acUnit.upsert({
      where: { id: acId },
      update: {},
      create: {
        id: acId,
        roomId: r.id,
        ratedKw: 2.0,
        controllable: true,
        controlMode: 'ir',
      },
    });

    for (let day = 0; day < 7; day++) {
      await prisma.schedule.upsert({
        where: { id: `sch_${acId}_${day}` },
        update: {},
        create: {
          id: `sch_${acId}_${day}`,
          acUnitId: acId,
          weekday: day,
          onTime: day === 0 ? '00:00' : '08:45',
          offTime: day === 0 ? '00:00' : '16:30',
          setpointC: 24.0,
          active: day !== 0,
        },
      });
    }
  }

  // 4. Initial Recommendations
  await prisma.recommendation.upsert({
    where: { id: 'rec_hall_a_pre_cool' },
    update: {},
    create: {
      id: 'rec_hall_a_pre_cool',
      roomId: 'HALL_A',
      acUnitId: 'ac_HALL_A',
      type: 'schedule',
      priority: 'high',
      issue: 'Session starts at 08:30 while outdoor temperature rises rapidly.',
      evidence: ['Historical cooldown requires 22 minutes', 'Forecast ambient 31°C at 08:00'],
      action: 'Shift start time from 08:30 to 08:15 for optimized pre-cooling at lower power.',
      estKwh: 4.5,
      estCostInr: 36.0,
      confidence: 90,
      status: 'pending',
      explanation: 'Pre-cooling the lecture hall before high heat-load arrival avoids compressor strain and peak-tariff spikes.',
    },
  });

  await prisma.recommendation.upsert({
    where: { id: 'rec_hall_c_temp_raise' },
    update: {},
    create: {
      id: 'rec_hall_c_temp_raise',
      roomId: 'HALL_C',
      acUnitId: 'ac_HALL_C',
      type: 'temperature',
      priority: 'medium',
      issue: 'Observed AC setpoint is set to 21°C during low occupancy seminars.',
      evidence: ['Comfort band allows up to 25°C', 'Average occupancy only 35%'],
      action: 'Raise setpoint from 21°C to 24°C.',
      estKwh: 12.0,
      estCostInr: 96.0,
      confidence: 88,
      status: 'pending',
      explanation: 'Increasing setpoint by 3°C maintains thermal comfort while saving approximately 18% compressor energy.',
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
