import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { User, Content } from '../models';
import type { ILifebookSection, ILesson } from '../models/Content';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { emitCatalogChanged } from '../services/realtime';

const LIFEBOOK_UPDATE_FIELDS = [
  'title',
  'description',
  'thumbnailUrl',
  'language',
  'type',
  'intro',
  'lessons',
  'conclusion',
  'status',
] as const;

/** GET /admin/stats */
export const getAdminStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [totalUsers, totalBooksPublished, activePremiumSubscribers, books] =
      await Promise.all([
        User.countDocuments(),
        Content.countDocuments({ contentType: 'lifebook', status: 'live' }),
        User.countDocuments({ subscriptionStatus: 'premium' }),
        Content.find({ contentType: 'lifebook', status: 'live' })
          .sort({ listenCount: -1 })
          .limit(1)
          .select({ title: 1 })
          .lean(),
      ]);
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalBooksPublished,
        activePremiumSubscribers,
        totalChaptersUploaded: 0,
        mostListenedBook: books[0]?.title ?? 'Not available',
      },
    });
  } catch (err) {
    next(err);
  }
};

function pickLifebookFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LIFEBOOK_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}

function normalizeSection(v: unknown): ILifebookSection | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const description = typeof o.description === 'string' ? o.description.trim() : '';
  const mediaUrl = typeof o.mediaUrl === 'string' ? o.mediaUrl.trim() : '';
  const mediaType = o.mediaType === 'audio' || o.mediaType === 'video' ? o.mediaType : undefined;
  if (!title || !mediaUrl || !mediaType) return null;
  return { title, description, mediaUrl, mediaType };
}

function normalizeLessons(v: unknown): ILesson[] {
  if (!Array.isArray(v)) return [];
  const out: ILesson[] = [];
  v.forEach((item, index) => {
    const section = normalizeSection(item);
    if (!section) return;
    const order = typeof (item as Record<string, unknown>).order === 'number'
      ? (item as Record<string, unknown>).order as number
      : index;
    out.push({ ...section, order });
  });
  return out.sort((a, b) => a.order - b.order);
}

const USER_ADMIN_KEYS = ['_id', 'name', 'email', 'role', 'subscriptionActive', 'subscriptionExpiry', 'blocked', 'createdAt'] as const;

function formatUserForAdmin(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.id = doc._id;
  for (const k of USER_ADMIN_KEYS) {
    if (k === '_id') continue;
    if (Object.prototype.hasOwnProperty.call(doc, k)) out[k] = doc[k];
  }
  return out;
}

/** GET /admin/users — id, name, email, role, subscriptionActive, subscriptionExpiry, createdAt; exclude password */
export const getUsers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, users: users.map((u) => formatUserForAdmin(u as Record<string, unknown>)) });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/books — return all lifebooks regardless of status */
export const getAllBooks = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const books = await Content.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, books });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/books — create lifebook; status = draft */
export const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const thumbnailUrl = typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl.trim() : '';
    const language = typeof body.language === 'string' ? body.language.trim() : '';
    const type = body.type === 'free' || body.type === 'premium' ? body.type : undefined;
    const intro = normalizeSection(body.intro);
    const conclusion = normalizeSection(body.conclusion);
    const lessons = normalizeLessons(body.lessons);

    if (!title) return next(new BadRequestError('title is required'));
    if (!thumbnailUrl) return next(new BadRequestError('thumbnailUrl is required'));
    if (!language) return next(new BadRequestError('language is required'));
    if (!type) return next(new BadRequestError('type must be free or premium'));
    if (!intro && lessons.length === 0) {
      return next(new BadRequestError('Add at least one episode MP3 or an intro audio file'));
    }

    const requestedStatus = body.status === 'live' || body.status === 'coming_soon'
      ? body.status
      : 'draft';
    const book = await Content.create({
      contentType: 'lifebook',
      title,
      description: description || '',
      thumbnailUrl,
      language,
      type,
      status: requestedStatus,
      intro,
      lessons,
      conclusion,
    });
    emitCatalogChanged('created', book.id, book.contentType);
    res.status(201).json({ success: true, book });
  } catch (err) {
    next(err);
  }
};

/** PUT /admin/books/:id — update lifebook; do not allow updating status */
export const updateBook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }
    const payload = pickLifebookFields(req.body as Record<string, unknown>);
    if (Object.keys(payload).length === 0) {
      const existing = await Content.findById(req.params.id);
      if (!existing) return next(new NotFoundError('Book not found'));
      return void res.json({ success: true, book: existing });
    }
    if (payload.intro !== undefined) {
      const intro = normalizeSection(payload.intro);
      if (!intro) return next(new BadRequestError('intro must have title, mediaUrl, mediaType'));
      payload.intro = intro;
    }
    if (payload.conclusion !== undefined) {
      const conclusion = normalizeSection(payload.conclusion);
      if (!conclusion) return next(new BadRequestError('conclusion must have title, mediaUrl, mediaType'));
      payload.conclusion = conclusion;
    }
    if (payload.lessons !== undefined) {
      payload.lessons = normalizeLessons(payload.lessons);
    }
    const book = await Content.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!book) return next(new NotFoundError('Book not found'));
    emitCatalogChanged('updated', book.id, book.contentType);
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
};

/** DELETE /admin/books/:id */
export const deleteBook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const book = await Content.findByIdAndDelete(req.params.id);
    if (!book) return next(new NotFoundError('Book not found'));
    emitCatalogChanged('deleted', book.id, book.contentType);
    res.json({ success: true, message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/books/:id/status — update only status */
export const updateBookStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }
    const status = req.body?.status;
    if (status !== 'draft' && status !== 'coming_soon' && status !== 'live') {
      return next(new BadRequestError('status must be draft, coming_soon, or live'));
    }
    const book = await Content.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!book) return next(new NotFoundError('Book not found'));
    emitCatalogChanged('updated', book.id, book.contentType);
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
};

const SUBSCRIPTION_DAYS = 30;

/** PATCH /admin/users/:id/activate — set subscriptionActive=true, subscriptionExpiry=now+30 days; return updated user */
export const activateUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return next(new NotFoundError('User not found'));

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + SUBSCRIPTION_DAYS);

    targetUser.subscriptionActive = true;
    targetUser.subscriptionExpiry = expiry;
    await targetUser.save();

    const plain = targetUser.toObject ? targetUser.toObject() : (targetUser as unknown as Record<string, unknown>);
    res.json({ success: true, user: formatUserForAdmin(plain as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/users/:id/deactivate — set subscriptionActive=false, subscriptionExpiry=null; return updated user */
export const deactivateUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { subscriptionActive: false, subscriptionExpiry: null },
      { new: true }
    )
      .select('-password')
      .lean();
    if (!user) return next(new NotFoundError('User not found'));
    res.json({ success: true, user: formatUserForAdmin(user as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /admin/users/:id — remove user from DB */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return next(new NotFoundError('User not found'));
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/users/:id/block */
export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { blocked: true },
      { new: true }
    )
      .select('-password')
      .lean();
    if (!user) return next(new NotFoundError('User not found'));
    res.json({ success: true, user: formatUserForAdmin(user as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/users/:id/unblock */
export const unblockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { blocked: false },
      { new: true }
    )
      .select('-password')
      .lean();
    if (!user) return next(new NotFoundError('User not found'));
    res.json({ success: true, user: formatUserForAdmin(user as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};
