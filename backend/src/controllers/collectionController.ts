import { Request, Response, NextFunction } from 'express';
import { User, Book } from '../models';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

export const getCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const user = await User.findById(req.user._id)
      .populate('bookCollection')
      .select('bookCollection');
    const populated = (user?.bookCollection || []) as unknown as { status?: string }[];
    const books = populated.filter((b) => b && b.status === 'live');
    res.json({ success: true, collection: books });
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
    const { bookId } = req.params;
    const book = await Book.findById(bookId);
    if (!book) return next(new NotFoundError('Book not found'));
    if (book.status !== 'live') return next(new BadRequestError('Book is not available'));

    const isPremium = book.type === 'premium';
    if (isPremium && !req.user.subscriptionActive) {
      return next(new ForbiddenError('Premium subscription required to add this book'));
    }

    const user = await User.findById(req.user._id);
    if (!user) return next(new NotFoundError('User not found'));
    const objectId = book._id;
    if (user.bookCollection.some((id) => id.toString() === objectId.toString())) {
      res.json({ success: true, message: 'Already in collection' });
      return;
    }
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
    const { bookId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return next(new NotFoundError('User not found'));
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
