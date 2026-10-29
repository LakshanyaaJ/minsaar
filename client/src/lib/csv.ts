import Papa from 'papaparse';

export interface CsvValidationResult<T> {
  valid: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
  metadata: {
    unitCount?: number;
    roomCount?: number;
    hallCount?: number;
    start?: Date;
    end?: Date;
    startDateStr?: string;
    endDateStr?: string;
    durationDays?: number;
    rowCount?: number;
    invalidRowsCount?: number;
    units?: string[];
    halls?: string[];
    hallNames?: string[];
    hallsCovered?: string[];
    scheduledSessions?: number;
    closedDays?: number;
    dateRange?: string;
    [key: string]: any;
  };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const validateReadingsCsv = (content: string): CsvValidationResult<any> => {
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  const errors: string[] = [];
  const warnings: string[] = [];
  const headers = parsed.meta.fields || [];

  const isSynthetic = headers.includes('hall_id') && (headers.includes('meter_reading') || headers.includes('whole_hall_power_kw'));
  const isLegacy = headers.includes('ac_unit_id') && headers.includes('power_kw');

  if (!isSynthetic && !isLegacy) {
    errors.push('Missing required columns. Expected either synthetic telemetry schema (timestamp, hall_id, meter_reading, indoor_temperature_c...) or legacy format (date_time, room, ac_unit_id, power_kw...).');
    return { valid: false, data: [], errors, warnings, metadata: {} };
  }

  const data = parsed.data as any[];
  const units = new Set<string>();
  const rooms = new Set<string>();
  const hallNamesSet = new Set<string>();
  let earliest = new Date(8640000000000000);
  let latest = new Date(-8640000000000000);
  let firstTimestampStr = '';
  let lastTimestampStr = '';
  let invalidRows = 0;

  data.forEach((row, i) => {
    const rowNum = i + 2;
    let rowInvalid = false;

    if (isSynthetic) {
      const pKw = parseFloat(row.whole_hall_power_kw || row.ac_power_kw || '0');
      const meterReading = parseFloat(row.meter_reading || '0');
      if (isNaN(pKw) || pKw < 0 || isNaN(meterReading) || meterReading < 0) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: power_kw/meter_reading must be >= 0`);
        rowInvalid = true;
      }

      const roomTemp = parseFloat(row.indoor_temperature_c || '25');
      if (roomTemp < 10 || roomTemp > 50) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: indoor_temperature_c out of range (10-50)`);
        rowInvalid = true;
      }

      units.add(`ac_${row.hall_id}`);
      rooms.add(row.hall_id);
      if (row.hall_name) hallNamesSet.add(row.hall_name);

      const rawTs = row.timestamp;
      if (!firstTimestampStr && rawTs) firstTimestampStr = rawTs;
      if (rawTs) lastTimestampStr = rawTs;

      const d = new Date(row.timestamp);
      if (!isNaN(d.getTime())) {
        if (d < earliest) earliest = d;
        if (d > latest) latest = d;
      }
    } else {
      const pKw = parseFloat(row.power_kw);
      if (isNaN(pKw) || pKw < 0) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: power_kw must be >= 0`);
        rowInvalid = true;
      }

      const setTemp = parseFloat(row.set_temp_c);
      const roomTemp = parseFloat(row.room_temp_c);
      if (setTemp < 10 || setTemp > 45) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: set_temp_c out of range (10-45)`);
        rowInvalid = true;
      }
      if (roomTemp < 10 || roomTemp > 45) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: room_temp_c out of range (10-45)`);
        rowInvalid = true;
      }

      if (!['0', '1'].includes(row.occupancy)) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: occupancy must be 0 or 1`);
        rowInvalid = true;
      }
      if (!['0', '1'].includes(row.on_off_status)) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: on_off_status must be 0 or 1`);
        rowInvalid = true;
      }

      units.add(row.ac_unit_id);
      rooms.add(row.room);

      const rawTs = row.date_time;
      if (!firstTimestampStr && rawTs) firstTimestampStr = rawTs;
      if (rawTs) lastTimestampStr = rawTs;

      const d = new Date(row.date_time);
      if (!isNaN(d.getTime())) {
        if (d < earliest) earliest = d;
        if (d > latest) latest = d;
      }
    }

    if (rowInvalid) invalidRows++;
  });

  const durationDays = (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
  if (durationDays < 7 && durationDays > 0) {
    warnings.push(`Dataset contains less than 7 days of data (${durationDays.toFixed(1)} days). Models perform better with at least 168 hours of historical data.`);
  }

  if (errors.length > 0) {
    errors.push(`Total errors: ${errors.length} (showing first 10)`);
  }

  const startDateStr = firstTimestampStr || (earliest.getTime() !== 8640000000000000 ? earliest.toISOString().replace('T', ' ').substring(0, 19) : 'N/A');
  const endDateStr = lastTimestampStr || (latest.getTime() !== -8640000000000000 ? latest.toISOString().replace('T', ' ').substring(0, 19) : 'N/A');

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    metadata: {
      unitCount: units.size,
      roomCount: rooms.size,
      hallCount: rooms.size,
      units: Array.from(units),
      halls: Array.from(rooms),
      hallNames: Array.from(hallNamesSet),
      start: earliest,
      end: latest,
      startDateStr,
      endDateStr,
      durationDays: durationDays > 0 ? Number(durationDays.toFixed(1)) : 0,
      rowCount: data.length,
      invalidRowsCount: invalidRows,
      dateRange: `${startDateStr.substring(0, 10)} to ${endDateStr.substring(0, 10)}`,
    },
  };
};

export const validateScheduleCsv = (content: string, readingUnits: Set<string> = new Set()): CsvValidationResult<any> => {
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  const errors: string[] = [];
  const warnings: string[] = [];
  const headers = parsed.meta.fields || [];

  const isSynthetic = headers.includes('hall_id') && headers.includes('schedule_status');
  const isLegacy = headers.includes('ac_unit_id') && headers.includes('weekday');

  if (!isSynthetic && !isLegacy) {
    errors.push('Missing required schedule columns. Expected either weekly schedule schema (hall_id, schedule_status, start_time, end_time...) or legacy schema (ac_unit_id, weekday, on_time, off_time...).');
    return { valid: false, data: [], errors, warnings, metadata: {} };
  }

  const data = parsed.data as any[];
  const scheduleUnits = new Set<string>();
  let scheduledCount = 0;
  let closedCount = 0;
  let earliest = new Date(8640000000000000);
  let latest = new Date(-8640000000000000);
  let firstDateStr = '';
  let lastDateStr = '';

  data.forEach((row, i) => {
    const rowNum = i + 2;

    if (isSynthetic) {
      if (row.schedule_status === 'SCHEDULED') {
        scheduledCount++;
        if (!row.start_time || !row.end_time) {
          if (errors.length < 10) errors.push(`Row ${rowNum}: start_time and end_time required for SCHEDULED sessions`);
        } else if (row.start_time >= row.end_time) {
          if (errors.length < 10) errors.push(`Row ${rowNum}: end_time must be after start_time`);
        }
      } else if (row.schedule_status === 'CLOSED') {
        closedCount++;
      }
      scheduleUnits.add(row.hall_id);

      const rawDate = row.start_datetime ? row.start_datetime.substring(0, 10) : row.session_date;
      if (!firstDateStr && rawDate) firstDateStr = rawDate;
      if (rawDate) lastDateStr = rawDate;

      const d = new Date(row.start_datetime || row.session_date);
      if (!isNaN(d.getTime())) {
        if (d < earliest) earliest = d;
        if (d > latest) latest = d;
      }
    } else {
      if (!WEEKDAYS.includes(row.weekday)) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: Invalid weekday ${row.weekday}`);
      }
      if (row.on_time >= row.off_time) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: off_time must be after on_time`);
      }
      scheduleUnits.add(row.ac_unit_id);
    }
  });

  readingUnits.forEach(u => {
    const bareHall = u.replace(/^ac_/, '');
    if (!scheduleUnits.has(u) && !scheduleUnits.has(bareHall)) {
      warnings.push(`Hall/Unit ${u} is in telemetry readings but missing from schedule.`);
    }
  });

  const startDateStr = firstDateStr || (earliest.getTime() !== 8640000000000000 ? earliest.toISOString().substring(0, 10) : 'N/A');
  const endDateStr = lastDateStr || (latest.getTime() !== -8640000000000000 ? latest.toISOString().substring(0, 10) : 'N/A');
  const durationDays = earliest.getTime() !== 8640000000000000 && latest.getTime() !== -8640000000000000
    ? Number(((latest.getTime() - earliest.getTime()) / (1000 * 3600 * 24)).toFixed(1))
    : 0;

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    metadata: {
      unitCount: scheduleUnits.size,
      hallsCovered: Array.from(scheduleUnits),
      scheduledSessions: scheduledCount,
      closedDays: closedCount,
      startDateStr,
      endDateStr,
      durationDays,
      rowCount: data.length,
      dateRange: `${startDateStr} to ${endDateStr}`,
    },
  };
};

export const generateSampleReadingsCsv = (): string => {
  return `timestamp,hall_id,hall_name,building_id,meter,meter_reading,air_temperature,dew_temperature,cloud_coverage,wind_speed,site_id,hour_of_day,day_of_week,month,is_weekend,primary_use,primary_use_code,square_feet,year_built,floor_count,indoor_temperature_c,indoor_relative_humidity_pct,occupancy_count,expected_occupancy,scheduled_open,scheduled_session_id,observed_ac_on,observed_setpoint_c,ac_equipment_type,cooling_capacity_kw,ac_rated_input_kw,rated_cop,compressor_modulation_pct,ac_power_kw,non_ac_power_kw,whole_hall_power_kw,ac_energy_kwh_min,simulated_cooling_effectiveness_pct
2026-11-01 00:00:00,HALL_A,Lecture Hall A,637,0,0.023,25.77,22.5,4,2.71,4,0,6,11,1,Education,0,4189,1929,3,27.0,71.96,0,0,0,,0,24.5,Inverter,28.0,8.0,3.5,0.0,0.0,1.4,1.4,0.0,92.3`;
};

export const generateSampleScheduleCsv = (): string => {
  return `session_id,session_date,day_of_week,hall_id,hall_name,schedule_status,start_time,end_time,start_datetime,end_datetime,expected_occupancy,occupancy_capacity,session_type,planned_setpoint_c,priority,extended_hours_flag,schedule_note
HALL_A_20261108_CLOSED,2026-11-08,Sunday,HALL_A,Lecture Hall A,CLOSED,,,,,0,60,Closed / no session,24.5,2,0,No session
HALL_A_20261109_01,2026-11-09,Monday,HALL_A,Lecture Hall A,SCHEDULED,08:30,12:30,2026-11-09 08:30:00,2026-11-09 12:30:00,42,60,Lecture,24.5,2,0,`;
};