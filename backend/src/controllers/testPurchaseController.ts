import { Request, Response, NextFunction } from 'express';
import { Content, User } from '../models';
import { BadRequestError } from '../utils/errors';

/** Test-only purchase simulation. Never use this route in production payments. */
export const testPurchaseBook = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (process.env.PAYMENTS_TEST_MODE !== 'true') {
      return next(new BadRequestError('Test purchases are disabled'));
    }
    if (!req.user) return next(new BadRequestError('Authentication required'));
    const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
    if (!bookId) return next(new BadRequestError('bookId is required'));

    const book = await Content.findOne({
      _id: bookId,
      contentType: 'lifebook',
      status: 'live',
    });
    if (!book) return next(new BadRequestError('Book not found'));
    if (book.type !== 'premium' && (book.priceInr ?? 0) <= 0) {
      return next(new BadRequestError('Free books do not require a purchase'));
    }

    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { purchasedBooks: book._id } },
    );
    const user = await User.findById(req.user._id).select('purchasedBooks');
    res.json({
      success: true,
      bookId: book.id,
      purchasedBookIds: (user?.purchasedBooks ?? []).map((id) => id.toString()),
      testMode: true,
    });
  } catch (error) {
    next(error);
  }
};
