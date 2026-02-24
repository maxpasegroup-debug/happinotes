import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { MongooseError } from 'mongoose';

interface ErrorResponse {
  success: false;
  message: string;
  stack?: string;
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    const payload: ErrorResponse = {
      success: false,
      message: err.message,
    };
    if (env.NODE_ENV === 'development' && err.stack) payload.stack = err.stack;
    res.status(err.statusCode).json(payload);
    return;
  }

  if (err.name === 'ValidationError') {
    const validationErr = err as MongooseError & { errors: Record<string, { message: string }> };
    const message = validationErr.errors
      ? Object.values(validationErr.errors).map((e) => e.message).join('; ')
      : 'Validation failed';
    res.status(400).json({ success: false, message });
    return;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  const statusCode = 500;
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  const payload: ErrorResponse = { success: false, message };
  if (env.NODE_ENV === 'development' && err.stack) payload.stack = err.stack;
  res.status(statusCode).json(payload);
};
