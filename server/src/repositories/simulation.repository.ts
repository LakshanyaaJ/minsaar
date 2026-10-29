import { prisma } from '../config/db';
import { SimulationJob, SimulationStep, Prisma } from '@prisma/client';

export class SimulationRepository {
  async createJob(data: Prisma.SimulationJobUncheckedCreateInput): Promise<SimulationJob> {
    return prisma.simulationJob.create({ data });
  }

  async findJobById(id: string, includeSteps = true, afterStep?: number): Promise<(SimulationJob & { steps: SimulationStep[] }) | null> {
    const job = await prisma.simulationJob.findUnique({
      where: { id },
      include: includeSteps ? {
        steps: {
          where: afterStep !== undefined ? { stepIndex: { gt: afterStep } } : undefined,
          orderBy: { stepIndex: 'asc' },
        },
      } : undefined,
    });

    return job as any;
  }

  async listJobs(): Promise<SimulationJob[]> {
    return prisma.simulationJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async updateJob(id: string, data: Prisma.SimulationJobUpdateInput): Promise<SimulationJob> {
    return prisma.simulationJob.update({
      where: { id },
      data,
    });
  }

  async deleteJob(id: string): Promise<SimulationJob> {
    return prisma.simulationJob.delete({
      where: { id },
    });
  }

  async createSteps(steps: Prisma.SimulationStepCreateManyInput[]): Promise<number> {
    const res = await prisma.simulationStep.createMany({
      data: steps,
      skipDuplicates: true,
    });
    return res.count;
  }

  async getLatestInterruptedJob(): Promise<SimulationJob | null> {
    return prisma.simulationJob.findFirst({
      where: { status: 'running' },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

export const simulationRepository = new SimulationRepository();
