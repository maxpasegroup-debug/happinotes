import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getBooks, getBookById, getFeaturedBooks, getUpcomingBooks } from '../controllers/booksController';
import { env } from '../config/env';
import { User } from '../models';
import { syncSubscriptionEntitlement } from '../services/subscriptionEntitlement';

const router = Router();

const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      const user = await User.findById(decoded.id);
      req.user = user ? await syncSubscriptionEntitlement(user) : undefined;
    }
  } catch {
    // Public book reads still work without a valid token.
  }
  next();
};

router.get('/', getBooks);
router.get('/featured', getFeaturedBooks);
router.get('/upcoming', getUpcomingBooks);
router.get('/:id', optionalAuth, getBookById);

export default router;
