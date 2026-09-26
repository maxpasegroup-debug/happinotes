import { Request, Response, NextFunction } from 'express';
import { Content } from '../models';
import { NotFoundError } from '../utils/errors';

function canAccessPremiumContent(req: Request): boolean {
  return req.user?.role === 'admin';
}

function hasPurchasedContent(req: Request, contentId: unknown): boolean {
  const id = String(contentId ?? '');
  return Boolean(req.user?.purchasedBooks?.some((bookId) => bookId.toString() === id));
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

/**
 * Shape a content document for public API:
 * - Only status 'live' or 'coming_soon' should reach here.
 * - coming_soon: only metadata; no media/sections.
 * - live + free: full content document.
 * - live + premium:
 *    - lifebook: if not subscribed → intro only; else full.
 *    - note/silence: if not subscribed → hide mediaUrl; else full.
 */
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

  const priceInr = Number(doc.priceInr ?? 0);
  const isPremium = type === 'premium' || priceInr > 0;
  const hasFullAccess = !isPremium || canAccessPremium;

  if (hasFullAccess) {
    const full = { ...doc };
    if (full._id && !full.id) {
      full.id = full._id;
    }
    return full;
  }

  // Premium without an individual purchase
  const out = { ...doc };
  if (out._id && !out.id) {
    out.id = out._id;
  }

  if (contentType === 'lifebook') {
    if (Array.isArray(out.lessons)) {
      out.lessons = (out.lessons as Record<string, unknown>[]).map((lesson) => ({
        title: lesson.title,
        description: lesson.description,
        order: lesson.order,
        mediaType: lesson.mediaType,
        mediaUrl: '',
      }));
    }
    delete out.conclusion;
    return out;
  }

  // note / silence: hide mediaUrl
  delete out.mediaUrl;
  out.contentType = contentType;
  return out;
}

export const getContents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const type = req.query.type as string | undefined;
    const statusQuery = req.query.status as string | undefined;
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const language = typeof req.query.language === 'string' ? req.query.language.trim().toLowerCase() : '';
    const view = req.query.view === 'mobile' ? 'mobile' : 'web';
    const orderKey = view === 'mobile' ? 'mobileDisplayOrder' : 'webDisplayOrder';
    const filter: Record<string, unknown> = {
      status: { $in: ['live', 'coming_soon'] },
    };
    if (statusQuery === 'draft' || statusQuery === 'coming_soon' || statusQuery === 'live') {
      filter.status = statusQuery;
    }
    if (type === 'lifebook' || type === 'note' || type === 'silence') {
      filter.contentType = type;
    } else if (type === 'happiness') {
      filter.contentType = 'silence';
    }
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (language && language !== 'all') {
      filter.language = language;
    }
    const contents = await Content.find(filter).lean();
    const ordered = [...contents].sort((a, b) => {
      const aDoc = a as Record<string, unknown>;
      const bDoc = b as Record<string, unknown>;
      const aFeatured = aDoc.featured === true ? 1 : 0;
      const bFeatured = bDoc.featured === true ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;

      const aOrder =
        typeof aDoc[orderKey] === 'number'
          ? (aDoc[orderKey] as number)
          : Number.MAX_SAFE_INTEGER;
      const bOrder =
        typeof bDoc[orderKey] === 'number'
          ? (bDoc[orderKey] as number)
          : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;

      const aCreated = Date.parse(String(aDoc.createdAt || '')) || 0;
      const bCreated = Date.parse(String(bDoc.createdAt || '')) || 0;
      return bCreated - aCreated;
    });
    const adminAccess = canAccessPremiumContent(req);
    const shaped = ordered.map((c) => {
      const doc = c as Record<string, unknown>;
      return shapeContentForPublic(doc, adminAccess || hasPurchasedContent(req, doc._id));
    });
    res.json({ success: true, contents: shaped });
  } catch (err) {
    next(err);
  }
};

export const getContentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const content = await Content.findById(req.params.id).lean();
    if (!content) {
      next(new NotFoundError('Content not found'));
      return;
    }
    const status = (content as Record<string, unknown>).status as string | undefined;
    if (status === 'draft') {
      next(new NotFoundError('Content not found'));
      return;
    }
    const doc = content as Record<string, unknown>;
    const canAccess = canAccessPremiumContent(req) || hasPurchasedContent(req, doc._id);
    const shaped = shapeContentForPublic(doc, canAccess);
    res.json({ success: true, content: shaped });
  } catch (err) {
    next(err);
  }
};

