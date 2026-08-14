import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { User, Book, Chapter, Offer, PaymentTransaction } from '../models';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { emitBooksChanged } from '../realtime';
import { deleteMedia } from '../services/cloudinary';
import { sendNotificationToUsers } from './notificationsController';

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

export const getStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activePremiumSubscribers,
      totalBooksPublished,
      totalChaptersUploaded,
      revenueAgg,
      recentPayments,
      usersPerWeek,
      mostListened,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ subscriptionStatus: { $in: ['premium', 'lifetime'] } }),
      Book.countDocuments({ status: 'live' }),
      Chapter.countDocuments(),
      PaymentTransaction.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: '$amountINR' } } },
      ]),
      PaymentTransaction.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(10),
      User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: { $isoWeek: '$createdAt' },
            users: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      mongoose.connection.collection('listeningprogresses').aggregate([
        { $group: { _id: '$bookId', listens: { $sum: 1 } } },
        { $sort: { listens: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            as: 'book',
          },
        },
        { $unwind: { path: '$book', preserveNullAndEmptyArrays: true } },
      ]).toArray(),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activePremiumSubscribers,
        revenueThisMonth: revenueAgg[0]?.revenue || 0,
        totalBooksPublished,
        totalChaptersUploaded,
        mostListenedBook: mostListened[0]?.book?.title || 'Not available',
      },
      usersPerWeek: usersPerWeek.map((item) => ({ week: `W${item._id}`, users: item.users })),
      recentPayments,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminBooks = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const books = await Book.aggregate([
      { $sort: { sortOrder: 1, createdAt: -1 } },
      {
        $lookup: {
          from: 'chapters',
          localField: '_id',
          foreignField: 'bookId',
          as: 'chapters',
        },
      },
      {
        $addFields: {
          chaptersCount: { $size: '$chapters' },
        },
      },
      { $project: { chapters: 0 } },
    ]);
    res.json({ success: true, books });
  } catch (err) {
    next(err);
  }
};

export const getAdminBookById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return next(new NotFoundError('Book not found'));
    const chapters = await Chapter.find({ bookId: book._id }).sort({ chapterNumber: 1 });
    res.json({ success: true, book, chapters });
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
    const book = await Book.create(req.body);
    emitBooksChanged('created', book._id.toString());
    if (book.status === 'live' || book.status === 'upcoming') {
      void sendNotificationToUsers({
        title: book.status === 'live' ? 'New audiobook available' : 'Audiobook coming soon',
        message: book.status === 'live' ? `${book.title} is ready to listen.` : `${book.title} is coming soon to HappiNotes.`,
        data: { type: 'book', bookId: book._id.toString() },
      }).catch((error) => console.error('Automatic book notification failed:', error));
    }
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
    const previousBook = await Book.findById(req.params.id);
    if (!previousBook) return next(new NotFoundError('Book not found'));
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!book) return next(new NotFoundError('Book not found'));
    if (previousBook.coverPublicId && previousBook.coverPublicId !== book.coverPublicId) {
      await deleteMedia(previousBook.coverPublicId, 'image');
    }
    if (previousBook.introAudioPublicId && previousBook.introAudioPublicId !== book.introAudioPublicId) {
      await deleteMedia(previousBook.introAudioPublicId, 'video');
    }
    emitBooksChanged('updated', book._id.toString());
    if (book.status === 'live' && previousBook.status !== 'live') {
      void sendNotificationToUsers({
        title: 'New audiobook available',
        message: `${book.title} is ready to listen.`,
        data: { type: 'book', bookId: book._id.toString() },
      }).catch((error) => console.error('Automatic book notification failed:', error));
    }
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
    await Chapter.deleteMany({ bookId: book._id });
    await Promise.all([
      deleteMedia(book.coverPublicId, 'image'),
      deleteMedia(book.introAudioPublicId, 'video'),
    ]);
    emitBooksChanged('deleted', book._id.toString());
    res.json({ success: true, message: 'Book deleted' });
  } catch (err) {
    next(err);
  }
};

export const addChapter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));

    const book = await Book.findById(req.params.id);
    if (!book) return next(new NotFoundError('Book not found'));

    const chapter = await Chapter.create({ ...req.body, bookId: book._id });
    res.status(201).json({ success: true, chapter });
  } catch (err) {
    next(err);
  }
};

export const updateChapter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));

    const chapter = await Chapter.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!chapter) return next(new NotFoundError('Chapter not found'));
    res.json({ success: true, chapter });
  } catch (err) {
    next(err);
  }
};

export const deleteChapter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);
    if (!chapter) return next(new NotFoundError('Chapter not found'));
    res.json({ success: true, message: 'Chapter deleted' });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return next(new NotFoundError('User not found'));
    const payments = await PaymentTransaction.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json({ success: true, user, payments });
  } catch (err) {
    next(err);
  }
};

export const updateUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subscriptionStatus, subscriptionExpiry } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        subscriptionStatus,
        subscriptionExpiry: subscriptionStatus === 'lifetime' ? null : subscriptionExpiry || null,
      },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return next(new NotFoundError('User not found'));
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

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

export const getPayments = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payments = await PaymentTransaction.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (err) {
    next(err);
  }
};

export const getOffers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json({ success: true, offers });
  } catch (err) {
    next(err);
  }
};

export const createOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));

    const offer = await Offer.create(req.body);
    res.status(201).json({ success: true, offer });
  } catch (err) {
    next(err);
  }
};

export const updateOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));

    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!offer) return next(new NotFoundError('Offer not found'));
    res.json({ success: true, offer });
  } catch (err) {
    next(err);
  }
};

export const deleteOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return next(new NotFoundError('Offer not found'));
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    next(err);
  }
};
