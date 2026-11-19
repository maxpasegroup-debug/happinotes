import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { MongooseError } from 'mongoose';
import multer from 'multer';

interface ErrorResponse {
  success: false;
  message: string;
}

// Operational errors are visible to clients. Replace the entire message if it
// contains diagnostics, including a configured credential printed on its own.
function publicMessage(message: string, fallback: string): string {
  if (/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\.env\b|process\.env|:\/\/|-----BEGIN |\bBearer\s+\S+|[\r\n]/.test(message)) return fallback;
  for (const [key, value] of Object.entries(process.env)) {
    if (value && value.length >= 6 && /secret|token|password|credential|api_key|private_key/i.test(key) && message.includes(value)) return fallback;
  }
  return message;
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
      message: publicMessage(err.message, 'The request could not be completed. Please try again.'),
    };
    res.status(err.statusCode).json(payload);
    return;
  }

  if (err.name === 'ValidationError') {
    const validationErr = err as MongooseError & { errors: Record<string, { message: string }> };
    const message = validationErr.errors
      ? Object.values(validationErr.errors).map((e) => e.message).join('; ')
      : 'Validation failed';
    res.status(400).json({ success: false, message: publicMessage(message, 'Validation failed') });
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
