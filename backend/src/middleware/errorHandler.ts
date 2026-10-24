import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { MongooseError } from 'mongoose';
import multer from 'multer';

interface ErrorResponse {
  success: false;
  message: string;
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Upload is too large. Each file must be 50 MB or smaller.'
      : err.code === 'LIMIT_FILE_COUNT'
        ? 'Too many files were included. Upload files in smaller groups.'
        : 'The upload form contains an unsupported or unexpected file field.';
    res.status(statusCode).json({ success: false, message });
    return;
  }

  if (err instanceof AppError) {
    const payload: ErrorResponse = {
      success: false,
      message: err.message,
    };
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
  // Unexpected errors can contain provider responses, credentials, or request
  // metadata even in development. Keep client responses safe in every mode.
  const payload: ErrorResponse = { success: false, message: 'Internal server error' };
  res.status(statusCode).json(payload);
};
