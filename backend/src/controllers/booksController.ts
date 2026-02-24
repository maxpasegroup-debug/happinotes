import { Request, Response, NextFunction } from 'express';
import { Book } from '../models';
import { NotFoundError } from '../utils/errors';

export const getBooks = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const books = await Book.find({ status: 'live' }).sort({ createdAt: -1 });
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
    const book = await Book.findById(req.params.id);
    if (!book) {
      return next(new NotFoundError('Book not found'));
    }
    if (book.status !== 'live') {
      return next(new NotFoundError('Book not found'));
    }
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
};
