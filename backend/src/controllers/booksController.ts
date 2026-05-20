import { Request, Response, NextFunction } from 'express';
import { FilterQuery } from 'mongoose';
import { Book, Chapter, IBook } from '../models';
import { NotFoundError } from '../utils/errors';

const buildPublicBookFilter = (req: Request): FilterQuery<IBook> => {
  const { language, category, accessType, query } = req.query;
  const filter: FilterQuery<IBook> = { status: 'live' };

  if (typeof language === 'string' && language !== 'all') filter.language = language;
  if (typeof category === 'string') filter.category = category;
  if (typeof accessType === 'string') filter.accessType = accessType;
  if (typeof query === 'string' && query.trim()) {
    filter.$text = { $search: query.trim() };
  }

  return filter;
};

const hasPremiumAccess = (req: Request) => {
  const status = req.user?.subscriptionStatus;
  return status === 'premium' || status === 'lifetime';
};

export const getBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const books = await Book.find(buildPublicBookFilter(req)).sort({
      sortOrder: 1,
      createdAt: -1,
    });
    res.json({ success: true, books });
  } catch (err) {
    next(err);
  }
};

export const getFeaturedBooks = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const books = await Book.find({ status: 'live', isFeatured: true }).sort({
      sortOrder: 1,
      createdAt: -1,
    });
    res.json({ success: true, books });
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
    const book = await Book.findOne({ _id: req.params.id, status: 'live' });
    if (!book) return next(new NotFoundError('Book not found'));

    const premiumAccess = hasPremiumAccess(req);
    const chapters = await Chapter.find({ bookId: book._id }).sort({ chapterNumber: 1 });
    const serializedChapters = chapters.map((chapter) => {
      const value = chapter.toObject();
      const locked = book.accessType === 'premium' && !chapter.isFreePreview && !premiumAccess;
      return {
        ...value,
        audioUrl: locked ? null : value.audioUrl,
        locked,
      };
    });

    res.json({
      success: true,
      book,
      chapters: serializedChapters,
    });
  } catch (err) {
    next(err);
  }
};
