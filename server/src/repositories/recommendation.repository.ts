import { prisma } from '../config/db';
import { Recommendation, Prisma } from '@prisma/client';

export class RecommendationRepository {
  async findAll(): Promise<Recommendation[]> {
    return prisma.recommendation.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Recommendation | null> {
    return prisma.recommendation.findUnique({ where: { id } });
  }

  async update(id: string, updates: Partial<Recommendation>): Promise<Recommendation> {
    return prisma.recommendation.update({
      where: { id },
      data: updates as Prisma.RecommendationUpdateInput,
    });
  }

  async create(data: Prisma.RecommendationUncheckedCreateInput): Promise<Recommendation> {
    return prisma.recommendation.create({ data });
  }
}

export const recommendationRepository = new RecommendationRepository();
