import { Request, Response, NextFunction } from 'express';
import { User, Content, HappyBite } from '../models';
import { isValidObjectId } from 'mongoose';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { assertAccountWritable } from '../services/accountDeletion';
import { canListenPremium, publicBite } from './happyBitesController';

export const getCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    await assertAccountWritable(req.user._id);
    const user = await User.findById(req.user._id)
      .populate('bookCollection')
      .populate({ path: 'happyBiteCollection', match: { published: true } })
      .select('bookCollection happyBiteCollection')
      .lean();
    const populated = (user?.bookCollection || []) as unknown as { status?: string }[];
    const books = populated.filter((b) => b && b.status === 'live');
    const bites = (user?.happyBiteCollection || []) as unknown as Record<string, unknown>[];
    const happyBites = bites.filter((bite) => bite && bite.published === true)
      .map((bite) => publicBite(bite, canListenPremium(req)));
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');
    res.json({ success: true, collection: books, happyBites });
  } catch (err) {
    next(err);
  }
};

export const addToCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    await assertAccountWritable(req.user._id);
    const { bookId } = req.params;
    if (!isValidObjectId(bookId)) return next(new BadRequestError('This story is unavailable. Please refresh the app and try again.'));
    const book = await Content.findById(bookId);
    if (!book) return next(new NotFoundError('Book not found'));
    if (book.status !== 'live') return next(new BadRequestError('Book is not available'));

    const requiresPurchase = book.type === 'premium' || book.priceInr > 0;
    const owned = req.user.purchasedBooks.some((id) => id.toString() === book._id.toString());
    const subscriptionActive = req.user.subscription?.active === true &&
      (!req.user.subscription.expiresAt || req.user.subscription.expiresAt > new Date());
    if (requiresPurchase && req.user.role !== 'admin' && !owned && !subscriptionActive) {
      return next(new ForbiddenError('Purchase this story before adding it to your library'));
    }

    const user = await User.findById(req.user._id);
    if (!user) return next(new NotFoundError('User not found'));
    const objectId = book._id;
    if (user.bookCollection.some((id) => id.toString() === objectId.toString())) {
      res.json({ success: true, message: 'Already in collection' });
      return;
    }
    await assertAccountWritable(req.user._id);
    user.bookCollection.push(objectId);
    await user.save();
    const updated = await User.findById(req.user._id)
      .populate('bookCollection')
      .select('bookCollection');
    res.status(201).json({ success: true, collection: updated?.bookCollection || [] });
  } catch (err) {
    next(err);
  }
};

export const removeFromCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    await assertAccountWritable(req.user._id);
    const { bookId } = req.params;
    if (!isValidObjectId(bookId)) return next(new BadRequestError('Invalid book ID'));
    const user = await User.findById(req.user._id);
    if (!user) return next(new NotFoundError('User not found'));
    await assertAccountWritable(req.user._id);
    user.bookCollection = user.bookCollection.filter((id) => id.toString() !== bookId);
    await user.save();
    const updated = await User.findById(req.user._id)
      .populate('bookCollection')
      .select('bookCollection');
    res.json({ success: true, collection: updated?.bookCollection || [] });
  } catch (err) {
    next(err);
  }
};

/** Bookmarks do not grant playback rights; the public Happy Bite API still checks Pro. */
export const addHappyBiteToCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const { biteId } = req.params;
    if (!isValidObjectId(biteId)) return next(new BadRequestError('Invalid Happy Bite ID'));
    await assertAccountWritable(req.user._id);
    const bite = await HappyBite.findOne({ _id: biteId, published: true }).select('_id');
    if (!bite) return next(new NotFoundError('Happy Bite not found'));
    await assertAccountWritable(req.user._id);
    const result = await User.updateOne(
      { _id: req.user._id, blocked: { $ne: true }, deletionState: { $nin: ['pending', 'completed'] } },
      { $addToSet: { happyBiteCollection: bite._id } },
    );
    if (!result.matchedCount) return next(new ForbiddenError('Account is not available'));
    res.status(201).json({ success: true });
  } catch (error) { next(error); }
};

export const removeHappyBiteFromCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const { biteId } = req.params;
    if (!isValidObjectId(biteId)) return next(new BadRequestError('Invalid Happy Bite ID'));
    await assertAccountWritable(req.user._id);
    // Allow removal even when the admin has deleted or unpublished the content.
    const result = await User.updateOne(
      { _id: req.user._id, blocked: { $ne: true }, deletionState: { $nin: ['pending', 'completed'] } },
      { $pull: { happyBiteCollection: biteId } },
    );
    if (!result.matchedCount) return next(new ForbiddenError('Account is not available'));
    res.json({ success: true });
  } catch (error) { next(error); }
};
