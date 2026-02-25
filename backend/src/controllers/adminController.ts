import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { User, Book } from '../models';
import { BadRequestError, NotFoundError } from '../utils/errors';

const ALLOWED_BOOK_FIELDS = [
  'title',
  'description',
  'coverImage',
  'audioUrl',
  'status',
  'type',
] as const;

function pickBookFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_BOOK_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}

export const getUsers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

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
    const payload = pickBookFields(req.body as Record<string, unknown>);
    const book = await Book.create(payload);
    res.status(201).json({ success: true, book });
  } catch (err) {
    next(err);
  }
};

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
    const payload = pickBookFields(req.body as Record<string, unknown>);
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!book) return next(new NotFoundError('Book not found'));
    res.json({ success: true, book });
  } catch (err) {
    next(err);
  }
};

export const deleteBook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return next(new NotFoundError('Book not found'));
    res.json({ success: true, message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};
