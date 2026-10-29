import Papa from 'papaparse';

export interface CsvValidationResult<T> {
  valid: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
  metadata: any;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const validateReadingsCsv = (content: string): CsvValidationResult<any> => {
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = ['date_time', 'room', 'ac_unit_id', 'power_kw', 'set_temp_c', 'room_temp_c', 'occupancy', 'on_off_status'];
  
  const headers = parsed.meta.fields || [];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`);
    return { valid: false, data: [], errors, warnings, metadata: {} };
  }

  const data = parsed.data as any[];
  const units = new Set<string>();
  const rooms = new Set<string>();
  let earliest = new Date(8640000000000000);
  let latest = new Date(-8640000000000000);

  data.forEach((row, i) => {
    const rowNum = i + 2;
    if (errors.length >= 10) return; // Cap error reporting

    const pKw = parseFloat(row.power_kw);
    if (isNaN(pKw) || pKw < 0) errors.push(`Row ${rowNum}: power_kw must be >= 0`);
    
    const setTemp = parseFloat(row.set_temp_c);
    const roomTemp = parseFloat(row.room_temp_c);
    if (setTemp < 10 || setTemp > 45) errors.push(`Row ${rowNum}: set_temp_c out of range (10-45)`);
    if (roomTemp < 10 || roomTemp > 45) errors.push(`Row ${rowNum}: room_temp_c out of range (10-45)`);
    
    if (!['0', '1'].includes(row.occupancy)) errors.push(`Row ${rowNum}: occupancy must be 0 or 1`);
    if (!['0', '1'].includes(row.on_off_status)) errors.push(`Row ${rowNum}: on_off_status must be 0 or 1`);

    units.add(row.ac_unit_id);
    rooms.add(row.room);
    
    const d = new Date(row.date_time);
    if (!isNaN(d.getTime())) {
      if (d < earliest) earliest = d;
      if (d > latest) latest = d;
    }
  });

  const durationDays = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
  if (durationDays < 7) {
    warnings.push(`Dataset contains less than 7 days of data (${durationDays.toFixed(1)} days). Models perform better with more history.`);
  }

  if (errors.length > 0) {
    errors.push(`Total errors: ${errors.length} (showing first 10)`);
  }

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    metadata: { unitCount: units.size, roomCount: rooms.size, start: earliest, end: latest }
  };
};

export const validateScheduleCsv = (content: string, readingUnits: Set<string> = new Set()): CsvValidationResult<any> => {
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = ['ac_unit_id', 'weekday', 'on_time', 'off_time', 'setpoint_c'];
  
  const headers = parsed.meta.fields || [];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`);
    return { valid: false, data: [], errors, warnings, metadata: {} };
  }

  const data = parsed.data as any[];
  const scheduleUnits = new Set<string>();

  data.forEach((row, i) => {
    const rowNum = i + 2;
    if (errors.length >= 10) return;

    if (!WEEKDAYS.includes(row.weekday)) errors.push(`Row ${rowNum}: Invalid weekday ${row.weekday}`);
    if (row.on_time >= row.off_time) errors.push(`Row ${rowNum}: off_time must be after on_time`);
    scheduleUnits.add(row.ac_unit_id);
  });

  readingUnits.forEach(u => {
    if (!scheduleUnits.has(u)) warnings.push(`AC unit ${u} is in readings but missing from schedule (will assume OFF always).`);
  });

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    metadata: { unitCount: scheduleUnits.size }
  };
};

export const generateSampleReadingsCsv = (): string => {
  const header = "date_time,room,ac_unit_id,power_kw,set_temp_c,room_temp_c,occupancy,on_off_status\n";
  let rows = "";
  let current = new Date('2026-10-01T00:00:00Z');
  for (let i = 0; i < 24 * 14; i++) { // 14 days
    const isDay = current.getUTCHours() >= 8 && current.getUTCHours() <= 17;
    rows += `${current.toISOString()},Computer Lab 1,ac_lab1_1,${isDay ? '2.5' : '0'},24,${isDay ? '24.5' : '28.0'},${isDay ? '1' : '0'},${isDay ? '1' : '0'}\n`;
    current = new Date(current.getTime() + 60 * 60 * 1000);
  }
  return header + rows;
};

export const generateSampleScheduleCsv = (): string => {
  const header = "ac_unit_id,weekday,on_time,off_time,setpoint_c\n";
  const rows = ['Mon','Tue','Wed','Thu','Fri'].map(d => `ac_lab1_1,${d},08:45,16:30,24`).join('\n');
  return header + rows + '\n';
};