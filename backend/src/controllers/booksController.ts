import { Request, Response, NextFunction } from 'express';
import { Book } from '../models';
import { NotFoundError } from '../utils/errors';
import { hasActiveSubscription } from '../utils/subscription';

function canAccessPremiumContent(req: Request): boolean {
  return hasActiveSubscription(req.user ?? null);
}

export const getBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const books = await Book.find({ status: 'live' })
      .sort({ createdAt: -1 })
      .lean();
    const canAccess = canAccessPremiumContent(req);
    const sanitized = books.map((book) => {
      const plain = book as Record<string, unknown>;
      if (plain.type === 'premium' && !canAccess) {
        const { audioUrl: _u, ...rest } = plain;
        return rest;
      }
      return plain;
    });
    res.json({ success: true, books: sanitized });
  } catch (err) {
    next(err);
  }
};

export const getBookById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const book = await Book.findById(req.params.id).lean();
    if (!book) {
      return next(new NotFoundError('Book not found'));
    }
    if (book.status !== 'live') {
      return next(new NotFoundError('Book not found'));
    }
    const plain = book as Record<string, unknown>;
    if (plain.type === 'premium' && !canAccessPremiumContent(req)) {
      const { audioUrl: _u, ...rest } = plain;
      return res.json({ success: true, book: rest });
    }
    res.json({ success: true, book: plain });
  } catch (err) {
    next(err);
  }
};
