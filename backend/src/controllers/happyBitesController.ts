import type { NextFunction, Request, Response } from 'express';
import { HappyBite } from '../models';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { isValidObjectId } from 'mongoose';

const MAX_PAGE_SIZE = 50;
const cleanText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function normalizePayload(body: Record<string, unknown>, partial = false) {
  const payload: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'thumbnailUrl', 'audioUrl', 'category'] as const) {
    if (!Object.prototype.hasOwnProperty.call(body, key) && partial) continue;
    const max = key === 'description' ? 2000 : key === 'title' ? 160 : key === 'category' ? 80 : 2048;
    const value = cleanText(body[key], max);
    if (!value) throw new BadRequestError(`${key} is required`);
    payload[key] = value;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'durationSeconds')) {
    const duration = Number(body.durationSeconds ?? 0);
    if (!Number.isFinite(duration) || duration < 0) throw new BadRequestError('durationSeconds must be a non-negative number');
    payload.durationSeconds = Math.floor(duration);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'displayOrder')) {
    const order = Number(body.displayOrder ?? 0);
    if (!Number.isSafeInteger(order) || order < 0) throw new BadRequestError('displayOrder must be a non-negative integer');
    payload.displayOrder = order;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'published')) {
    if (body.published !== undefined && typeof body.published !== 'boolean') throw new BadRequestError('published must be a boolean');
    payload.published = body.published === true;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'accessType')) {
    const accessType = body.accessType === undefined && !partial ? 'free' : body.accessType;
    if (accessType !== 'free' && accessType !== 'premium') throw new BadRequestError('accessType must be free or premium');
    payload.accessType = accessType;
  }
  return payload;
}

/** Uses the existing Pro entitlement, including the existing admin override. */
function canListenPremium(req: Request) {
  if (req.user?.role === 'admin') return true;
  const subscription = req.user?.subscription;
  return Boolean(subscription?.active && (!subscription.expiresAt || subscription.expiresAt > new Date()));
}

function publicBite(doc: Record<string, unknown>, premiumAccess: boolean) {
  const accessType = doc.accessType === 'premium' ? 'premium' : 'free';
  const locked = accessType === 'premium' && !premiumAccess;
  const { audioUrl, ...metadata } = doc;
  return { ...metadata, accessType, locked, ...(locked ? {} : { audioUrl }) };
}

function privateResponse(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
}

export async function listHappyBites(req: Request, res: Response, next: NextFunction) {
  try {
    privateResponse(res);
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const category = cleanText(req.query.category, 80);
    const filter: Record<string, unknown> = { published: true };
    if (category && category.toLowerCase() !== 'all') filter.category = category;
    const [happyBites, total, categories] = await Promise.all([
      HappyBite.find(filter).sort({ displayOrder: 1, createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      HappyBite.countDocuments(filter),
      HappyBite.distinct('category', { published: true }),
    ]);
    const premiumAccess = canListenPremium(req);
    res.json({ success: true, happyBites: happyBites.map((bite) => publicBite(bite, premiumAccess)), categories: categories.sort((a, b) => String(a).localeCompare(String(b))), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total } });
  } catch (error) { next(error); }
}

export async function getHappyBite(req: Request, res: Response, next: NextFunction) {
  try {
    privateResponse(res);
    if (!isValidObjectId(req.params.id)) throw new NotFoundError('Happy Bite not found');
    const happyBite = await HappyBite.findOne({ _id: req.params.id, published: true }).lean();
    if (!happyBite) throw new NotFoundError('Happy Bite not found');
    res.json({ success: true, happyBite: publicBite(happyBite, canListenPremium(req)) });
  } catch (error) { next(error); }
}

export async function listAdminHappyBites(_req: Request, res: Response, next: NextFunction) {
  try {
    const happyBites = await HappyBite.find().sort({ displayOrder: 1, createdAt: -1, _id: -1 }).lean();
    res.json({ success: true, happyBites: happyBites.map((bite) => ({ ...bite, accessType: bite.accessType ?? 'free' })) });
  } catch (error) { next(error); }
}

export async function createHappyBite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = normalizePayload(req.body ?? {});
    const happyBite = await HappyBite.create(body);
    res.status(201).json({ success: true, happyBite });
  } catch (error) { next(error); }
}

export async function updateHappyBite(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = normalizePayload(req.body ?? {}, true);
    const happyBite = await HappyBite.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true, runValidators: true });
    if (!happyBite) throw new NotFoundError('Happy Bite not found');
    res.json({ success: true, happyBite });
  } catch (error) { next(error); }
}

export async function deleteHappyBite(req: Request, res: Response, next: NextFunction) {
  try {
    const happyBite = await HappyBite.findByIdAndDelete(req.params.id);
    if (!happyBite) throw new NotFoundError('Happy Bite not found');
    res.json({ success: true, message: 'Happy Bite deleted' });
  } catch (error) { next(error); }
}
