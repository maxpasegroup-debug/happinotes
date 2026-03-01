import { Request, Response, NextFunction } from 'express';
import { Book } from '../models';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { hasActiveSubscription } from '../utils/subscription';

function canAccessPremiumContent(req: Request): boolean {
  return hasActiveSubscription(req.user ?? null);
}

/** Effective fullAudioUrl: fullAudioUrl or legacy audioUrl */
function getFullAudioUrl(plain: Record<string, unknown>): string | undefined {
  const full = plain.fullAudioUrl ?? plain.audioUrl;
  return typeof full === 'string' && full ? full : undefined;
}

function getIntroAudioUrl(plain: Record<string, unknown>): string | undefined {
  const intro = plain.introAudioUrl;
  return typeof intro === 'string' && intro ? intro : undefined;
}

/**
 * Sanitize book for API: never expose fullAudioUrl. Expose hasFullAccess (boolean).
 * introAudioUrl is still included for preview.
 */
function sanitizeBookForResponse(plain: Record<string, unknown>, canAccess: boolean): Record<string, unknown> {
  const isPremium = plain.type === 'premium';
  const hasFullAccess = !isPremium || canAccess;
  const out = { ...plain };
  delete out.audioUrl;
  delete out.fullAudioUrl;
  out.hasFullAccess = hasFullAccess;
  if (plain.introAudioUrl !== undefined) out.introAudioUrl = plain.introAudioUrl;
  return out;
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
    const sanitized = books.map((book) =>
      sanitizeBookForResponse(book as Record<string, unknown>, canAccess)
    );
    void res.json({ success: true, books: sanitized });
    return;
  } catch (err) {
    next(err);
    return;
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
      next(new NotFoundError('Book not found'));
      return;
    }
    if (book.status !== 'live') {
      next(new NotFoundError('Book not found'));
      return;
    }
    const plain = book as Record<string, unknown>;
    const canAccess = canAccessPremiumContent(req);
    const sanitized = sanitizeBookForResponse(plain, canAccess);
    void res.json({ success: true, book: sanitized });
    return;
  } catch (err) {
    next(err);
    return;
  }
};

/**
 * GET /books/:id/audio?segment=intro|full
 * Requires authenticate. Redirects to storage URL for the requested segment.
 * - segment=intro: always allowed (introAudioUrl).
 * - segment=full (default): for premium books requires active subscription; else 403.
 */
export const getBookAudio = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new ForbiddenError('Authentication required'));
      return;
    }
    const book = await Book.findById(req.params.id).lean();
    if (!book) {
      next(new NotFoundError('Book not found'));
      return;
    }
    if (book.status !== 'live') {
      next(new NotFoundError('Book not found'));
      return;
    }
    const plain = book as Record<string, unknown>;
    const segment = (req.query.segment as string) || 'full';

    if (segment === 'intro') {
      const url = getIntroAudioUrl(plain);
      if (!url) {
        next(new NotFoundError('Intro audio not available'));
        return;
      }
      void res.redirect(302, url);
      return;
    }

    if (segment === 'full') {
      const isPremium = plain.type === 'premium';
      if (isPremium && !canAccessPremiumContent(req)) {
        next(new ForbiddenError('Premium subscription required'));
        return;
      }
      const url = getFullAudioUrl(plain);
      if (!url) {
        next(new NotFoundError('Full audio not available'));
        return;
      }
      void res.redirect(302, url);
      return;
    }

    next(new NotFoundError('Invalid segment'));
    return;
  } catch (err) {
    next(err);
    return;
  }
};
