import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ListeningProgress } from '../models';
import { BadRequestError, ForbiddenError } from '../utils/errors';

export const getBookProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));

    const progress = await ListeningProgress.findOne({
      userId: req.user._id,
      bookId: req.params.bookId,
    }).populate('chapterId', 'title chapterNumber durationSeconds');

    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
};

export const saveProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));

    const { bookId, chapterId, positionSeconds, completed } = req.body;
    const progress = await ListeningProgress.findOneAndUpdate(
      { userId: req.user._id, bookId },
      {
        userId: req.user._id,
        bookId,
        chapterId,
        positionSeconds,
        completed: Boolean(completed),
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
};

export const getRecentProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));

    const progress = await ListeningProgress.find({
      userId: req.user._id,
      completed: false,
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .populate('bookId', 'title coverImageUrl totalDurationSeconds')
      .populate('chapterId', 'title chapterNumber durationSeconds');

    res.json({ success: true, progress });
  } catch (err) {
    next(err);
  }
};
