import fs from 'fs';
import path from 'path';
import { simulationService } from '../src/services/simulation.service';
import { prisma } from '../src/config/db';

async function verifyEndToEndBenchmark() {
  console.log('--- Starting End-to-End Benchmark Simulation Verification ---');

  const demoDir = path.resolve(__dirname, '../../synthetic_data');
  const demoCsvPath = path.join(demoDir, 'synthetic_demo.csv');
  const scheduleCsvPath = path.join(demoDir, 'weekly_schedule.csv');

  if (!fs.existsSync(demoCsvPath) || !fs.existsSync(scheduleCsvPath)) {
    throw new Error('Benchmark CSV files not found in minsaar/synthetic_data/');
  }

  console.log(`Reading synthetic benchmark telemetry (${(fs.statSync(demoCsvPath).size / 1024 / 1024).toFixed(1)} MB)...`);
  const demoCsvContent = fs.readFileSync(demoCsvPath, 'utf-8');

  console.log(`Reading weekly schedule CSV (${(fs.statSync(scheduleCsvPath).size / 1024).toFixed(1)} KB)...`);
  const scheduleCsvContent = fs.readFileSync(scheduleCsvPath, 'utf-8');

  // Create simulation for 1-hour intervals
  console.log('Triggering simulation creation in service...');
  const { id: jobId } = await simulationService.createSimulation(
    undefined,
    demoCsvContent,
    scheduleCsvContent,
    { intervalHours: 1, tariffInrPerKwh: 8.0 },
    'synthetic_demo.csv',
    'weekly_schedule.csv'
  );

  console.log(`Simulation Job created with ID: ${jobId}`);

  // Poll until completion
  let attempts = 0;
  const maxAttempts = 60;
  let job: any = null;

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000));
    attempts++;
    job = await simulationService.getSimulation(jobId, 0);
    console.log(`[Attempt ${attempts}] Status: ${job.status}, Progress: ${(job.progress * 100).toFixed(0)}%, Completed Steps: ${job.stepsCompleted}`);

    if (job.status === 'done' || job.status === 'failed') {
      break;
    }
  }

  if (job.status !== 'done') {
    throw new Error(`Simulation did not finish successfully! Status: ${job.status}, error: ${job.error}`);
  }

  console.log('\n--- Simulation Summary Results ---');
  console.log(JSON.stringify(job.summary, null, 2));

  // Verify step persistence in PostgreSQL
  const dbStepsCount = await prisma.simulationStep.count({
    where: { jobId },
  });
  console.log(`\nPersisted simulation steps in PostgreSQL: ${dbStepsCount}`);

  if (dbStepsCount === 0) {
    throw new Error('No simulation steps were persisted to PostgreSQL!');
  }

  // Cleanup test job
  await simulationService.deleteSimulation(jobId);
  console.log(`Cleaned up test simulation job ${jobId}`);

  console.log('\n--- Verification Succeeded! ---');
}

verifyEndToEndBenchmark()
  .catch(err => {
    console.error('Benchmark verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
