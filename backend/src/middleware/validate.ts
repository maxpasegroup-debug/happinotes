import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { BadRequestError } from '../utils/errors';

export const validateRequest = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(new BadRequestError(errors.array()[0].msg));
    return;
  }
  next();
};
