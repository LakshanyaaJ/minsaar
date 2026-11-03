import cron from 'node-cron';
import { prisma } from '../config/db';
import { simulationRepository } from '../repositories/simulation.repository';

export class CronRunner {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.ENABLE_CRON !== 'false' && process.env.NODE_ENV !== 'test';
  }

  start() {
    if (!this.isEnabled) {
      console.log('Cron jobs disabled by configuration or in test environment.');
      return;
    }

    console.log('Starting background cron jobs...');

    // 1. Startup Cleanup: Mark any orphaned 'running' jobs as 'failed' upon server start
    this.cleanupInterruptedJobs();

    // 2. Schedule & Control Runner (runs every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.runScheduleCheck();
      } catch (err) {
        console.error('Error during scheduled control check:', err);
      }
    });

    // 3. Daily maintenance (at midnight)
    cron.schedule('0 0 * * *', async () => {
      console.log('Running daily maintenance task...');
    });
  }

  private async cleanupInterruptedJobs() {
    try {
      const interrupted = await prisma.simulationJob.updateMany({
        where: { status: 'running' },
        data: {
          status: 'failed',
          error: 'Simulation job was interrupted by an application restart.',
        },
      });
      if (interrupted.count > 0) {
        console.log(`Cleaned up ${interrupted.count} interrupted simulation job(s).`);
      }
    } catch (err) {
      console.error('Failed to cleanup interrupted simulation jobs:', err);
    }
  }

  private async runScheduleCheck() {
    // Idempotent AC schedule verification
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0-6 (Sun-Sat)
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const activeSchedules = await prisma.schedule.findMany({
      where: {
        weekday: dayOfWeek,
        active: true,
      },
      include: {
        acUnit: {
          include: {
            room: true,
          },
        },
      },
    });

    for (const sch of activeSchedules) {
      const isWithinTime = currentTime >= sch.onTime && currentTime < sch.offTime;
      // 5-minute per-unit throttle check: verify no duplicate command within 5 mins
      const recentCommand = await prisma.controlCommand.findFirst({
        where: {
          acUnitId: sch.acUnitId,
          timestamp: { gte: new Date(now.getTime() - 5 * 60 * 1000) },
        },
      });

      if (!recentCommand) {
        // Record planned state
        await prisma.controlCommand.create({
          data: {
            acUnitId: sch.acUnitId,
            commandType: isWithinTime ? 'SETPOINT' : 'OFF',
            payload: { setpointC: sch.setpointC, targetState: isWithinTime ? 'ON' : 'OFF' },
            plannedOrSent: 'planned',
            status: 'executed',
            reason: isWithinTime
              ? `Scheduled active operating window (${sch.onTime} - ${sch.offTime})`
              : 'Outside scheduled operating window',
            createdBy: 'cron_scheduler',
          },
        });
      }
    }
  }
}

export const cronRunner = new CronRunner();
