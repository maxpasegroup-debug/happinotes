import { Request, Response, NextFunction } from 'express';
import { User, Content } from '../models';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { hasActiveSubscription } from '../utils/subscription';

function canAccessPremiumContent(req: Request): boolean {
  return hasActiveSubscription(req.user ?? null);
}

const COMING_SOON_KEYS = [
  '_id',
  'title',
  'description',
  'thumbnailUrl',
  'language',
  'type',
  'status',
  'contentType',
] as const;

function toComingSoonStub(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.id = doc._id;
  for (const k of COMING_SOON_KEYS) {
    if (k === '_id') continue;
    if (Object.prototype.hasOwnProperty.call(doc, k)) {
      out[k] = doc[k];
    }
  }
  return out;
}

// Same premium gating as public content
function shapeContentForPublic(
  doc: Record<string, unknown>,
  canAccessPremium: boolean
): Record<string, unknown> {
  const status = doc.status as string | undefined;
  const type = doc.type as string | undefined;
  const rawContentType = doc.contentType as string | undefined;
  const contentType =
    rawContentType === 'mindspace' ? 'silence' : rawContentType;

  if (status === 'coming_soon') {
    return toComingSoonStub(doc);
  }

  if (status !== 'live') {
    return toComingSoonStub(doc);
  }

  const isPremium = type === 'premium';
  const hasFullAccess = !isPremium || canAccessPremium;

  if (hasFullAccess) {
    const full = { ...doc };
    if (full._id && !full.id) {
      full.id = full._id;
    }
    return full;
  }

  const out = { ...doc };
  if (out._id && !out.id) {
    out.id = out._id;
  }

  if (contentType === 'lifebook') {
    delete out.lessons;
    delete out.conclusion;
    return out;
  }

  delete out.mediaUrl;
  out.contentType = contentType;
  return out;
}

export const addFavourite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new ForbiddenError('Authentication required'));
      return;
    }
    const { contentId } = req.params;
    const content = await Content.findById(contentId);
    if (!content) {
      next(new NotFoundError('Content not found'));
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      next(new NotFoundError('User not found'));
      return;
    }

    const exists = (user.favourites || []).some(
      (fav) => fav.contentId.toString() === content._id.toString()
    );
    if (!exists) {
      user.favourites.push({
        contentId: content._id,
        contentType: content.contentType,
      } as any);
      await user.save();
    }

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const removeFavourite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new ForbiddenError('Authentication required'));
      return;
    }
    const { contentId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      next(new NotFoundError('User not found'));
      return;
    }
    user.favourites = (user.favourites || []).filter(
      (fav) => fav.contentId.toString() !== contentId
    );
    await user.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getFavourites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new ForbiddenError('Authentication required'));
      return;
    }
    const user = await User.findById(req.user._id)
      .populate('favourites.contentId')
      .select('favourites');
    if (!user) {
      next(new NotFoundError('User not found'));
      return;
    }

    const canAccess = canAccessPremiumContent(req);
    const favs = (user.favourites || []) as unknown as {
      contentId?: Record<string, unknown> | null;
    }[];

    const items = favs
      .map((fav) => fav.contentId || null)
      .filter((doc): doc is Record<string, unknown> => !!doc)
      .map((doc) => {
        const status = doc.status as string | undefined;
        if (status === 'draft') {
          return null;
        }
        return shapeContentForPublic(doc, canAccess);
      })
      .filter((v): v is Record<string, unknown> => v != null);

    res.json({ success: true, favourites: items });
  } catch (err) {
    next(err);
  }
};

