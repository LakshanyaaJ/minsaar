import { recommendationRepository } from '../repositories/recommendation.repository';
import { Recommendation } from '@prisma/client';
import { NotFound } from '../utils/errors';
import { eventBus } from './eventBus.service';

export class RecommendationService {
  async getRecommendations(): Promise<Recommendation[]> {
    return recommendationRepository.findAll();
  }

  async patchRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation> {
    const rec = await recommendationRepository.findById(id);
    if (!rec) throw new NotFound(`Recommendation ${id} not found`);

    const updated = await recommendationRepository.update(id, updates);
    eventBus.emitEvent({
      type: 'recommendation',
      data: updated,
      timestamp: new Date().toISOString(),
    });
    return updated;
  }
}

export const recommendationService = new RecommendationService();
