import type { Building, Room, AcUnit, Schedule, Reading, Anomaly, Recommendation } from '../types/domain';
import { addDays, subDays, startOfHour, setHours } from 'date-fns';
import { kwh } from '../lib/energy';

let seed = 12345;
const random = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

const buildings: Building[] = [
  { id: 'b1', name: 'CSE Block' },
  { id: 'b2', name: 'Science Block' },
  { id: 'b3', name: 'Admin Block' },
];

const rooms: Room[] = [
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

const acUnits: AcUnit[] = rooms.flatMap((room, i) => {
  const units: AcUnit[] = [{
    id: `ac_${room.id}_1`,
    roomId: room.id,
    ratedKw: 1.5 + (random() * 2),
    controllable: true,
    controlMode: 'ir',
  }];
  // Add a second AC to larger rooms
  if (['computer_lab', 'seminar_hall'].includes(room.roomType) || i % 4 === 0) {
    units.push({
      id: `ac_${room.id}_2`,
      roomId: room.id,
      ratedKw: 2.0 + (random() * 3),
      controllable: true,
      controlMode: 'relay',
    });
  }
  return units;
});

const schedules: Schedule[] = acUnits.flatMap(unit => {
  return Array.from({ length: 7 }).map((_, day) => ({
    id: `sch_${unit.id}_${day}`,
    acUnitId: unit.id,
    weekday: day,
    onTime: day === 0 ? '00:00' : (day === 6 ? '09:00' : '08:45'),
    offTime: day === 0 ? '00:00' : (day === 6 ? '12:30' : '16:30'),
    setpointC: 24,
    active: day !== 0,
  }));
});

const generateReadings = () => {
  const readings: Reading[] = [];
  const now = startOfHour(new Date());
  
  for (let d = 30; d >= -7; d--) {
    const date = d > 0 ? subDays(now, d) : addDays(now, Math.abs(d));
    const isFuture = d <= 0;
    const dataSource = isFuture ? 'predicted' : 'simulated';

    for (let h = 0; h < 24; h++) {
      const ts = setHours(date, h).toISOString();
      const outdoorTempC = 25 + (Math.sin((h - 6) * (Math.PI / 12)) * 10) + (random() * 2);

      acUnits.forEach(unit => {
        let onOff = h >= 8 && h <= 17;
        let setTempC = 24;
        let powerKw = onOff ? unit.ratedKw * (0.6 + random() * 0.4) : 0;
        let occupancy = onOff ? 20 + random() * 80 : 0;

        // Anomalies Injection
        const room = rooms.find(r => r.id === unit.roomId);
        if (room?.name === 'Computer Lab 2' && h > 17 && h <= 19) {
          onOff = true;
          powerKw = unit.ratedKw * 0.8;
          occupancy = 0; // Empty room running
        }
        if (room?.name === 'Seminar Hall') {
          setTempC = 18; // Needless low setpoint
          if (onOff) powerKw = unit.ratedKw * 0.95; // works harder
        }
        if (unit.id === 'ac_r10_1' && (h === 2 || h === 3)) {
          onOff = true; // Night phantom run
          powerKw = unit.ratedKw * 0.5;
          occupancy = 0;
        }

        readings.push({
          acUnitId: unit.id,
          ts,
          powerKw,
          setTempC,
          roomTempC: onOff ? setTempC + random() * 1.5 : outdoorTempC - random() * 2,
          occupancy,
          onOff,
          outdoorTempC,
          dataSource,
        });
      });
    }
  }
  return readings;
};

const generateAnomalies = (): Anomaly[] => [
  { id: 'an_1', acUnitId: acUnits.find(u => u.roomId === rooms.find(r => r.name === 'Computer Lab 2')?.id)?.id || '', ts: new Date().toISOString(), category: 'runtime_after_hours', severity: 'critical', wastedKwhEst: kwh(3.2, 2), observations: ['Unit remained ON for 2 hours after scheduled closing time.'] },
  { id: 'an_2', acUnitId: acUnits.find(u => u.roomId === rooms.find(r => r.name === 'Seminar Hall')?.id)?.id || '', ts: new Date().toISOString(), category: 'setpoint_too_low', severity: 'high', wastedKwhEst: kwh(4.5, 6), observations: ['Setpoint at 18°C while room bounds are 23-25°C.'] },
  { id: 'an_3', acUnitId: 'ac_r10_1', ts: new Date().toISOString(), category: 'phantom_run', severity: 'medium', wastedKwhEst: kwh(1.5, 2), observations: ['AC ran at night (02:00-04:00) with 0% occupancy.'] },
];

const generateRecommendations = (): Recommendation[] => [
  { id: 'rec_1', roomId: rooms.find(r => r.name === 'Computer Lab 2')?.id || '', type: 'schedule', priority: 'critical', issue: 'AC runs past closing repeatedly.', evidence: ['Wasted 6.4 kWh daily average over last week.'], action: 'Enforce strict OFF schedule at 17:00.', estKwh: 128, estCostInr: 1024, confidence: 95, status: 'pending', explanation: 'Aligning operation with the 5 PM close time prevents phantom drain.' },
  { id: 'rec_2', roomId: rooms.find(r => r.name === 'Seminar Hall')?.id || '', type: 'temperature', priority: 'high', issue: 'Overcooling to 18°C.', evidence: ['Setpoint is 5°C below the 23°C lower bound.'], action: 'Lock minimum setpoint to 23°C.', estKwh: 315, estCostInr: 2520, confidence: 92, status: 'pending', explanation: 'Cooling beyond the agreed band yields diminishing comfort returns but high energy penalties.' },
];

export const seedDatabase = () => ({
  buildings,
  rooms,
  acUnits,
  schedules,
  readings: generateReadings(),
  anomalies: generateAnomalies(),
  recommendations: generateRecommendations(),
  settings: { tariffInrPerKwh: 8.0, timezone: 'Asia/Kolkata', mode: 'simulation' as const },
});