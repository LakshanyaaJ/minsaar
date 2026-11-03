import { Request, Response } from 'express';
import { recommendationService } from '../services/recommendation.service';

export class RecommendationController {
  async getRecommendations(req: Request, res: Response) {
    const recommendations = await recommendationService.getRecommendations();
    res.json(recommendations);
  }

  async patchRecommendation(req: Request, res: Response) {
    const { id } = req.params;
    const updated = await recommendationService.patchRecommendation(id, req.body);
    res.json(updated);
  }
}

export const recommendationController = new RecommendationController();
