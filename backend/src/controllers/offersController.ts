import { Request, Response, NextFunction } from 'express';
import { Offer } from '../models';

export const getActiveOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const now = new Date();
    const planId = typeof req.query.planId === 'string' ? req.query.planId : undefined;
    const offers = await Offer.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      ...(planId ? { appliesToPlan: { $in: [planId, 'all'] } } : {}),
    }).sort({ discountPercent: -1, createdAt: -1 });

    res.json({ success: true, offers });
  } catch (err) {
    next(err);
  }
};
