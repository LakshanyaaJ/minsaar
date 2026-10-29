import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { env } from '../config/env';

export const getKolkataTime = (date: Date = new Date()): Date => {
  return toZonedTime(date, env.APP_TIMEZONE);
};

export const parseTimeToMinutes = (timeHHMM: string): number => {
  const [h, m] = timeHHMM.split(':').map(Number);
  return h * 60 + m;
};

export const isWithinSchedule = (
  utcTimestamp: Date, 
  weekday: number, 
  onTimeHHMM: string, 
  offTimeHHMM: string
): boolean => {
  const localDate = toZonedTime(utcTimestamp, env.APP_TIMEZONE);
  const currentWeekday = localDate.getDay(); // 0 (Sun) to 6 (Sat)
  
  if (currentWeekday !== weekday) return false;

  const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();
  const onMins = parseTimeToMinutes(onTimeHHMM);
  const offMins = parseTimeToMinutes(offTimeHHMM);

  return currentMinutes >= onMins && currentMinutes < offMins;
};