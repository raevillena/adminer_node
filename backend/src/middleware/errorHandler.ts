import { Request, Response, NextFunction } from 'express';
import { DatabaseError } from '../../shared/types';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', err);

  // Default error
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle database connection errors
  if (err.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Database connection refused';
  }

  if (err.message.includes('ER_ACCESS_DENIED_ERROR')) {
    statusCode = 403;
    message = 'Database access denied';
  }

  if (err.message.includes('ER_BAD_DB_ERROR')) {
    statusCode = 400;
    message = 'Database does not exist';
  }

  // Handle SQL syntax errors
  if (err.message.includes('ER_PARSE_ERROR')) {
    statusCode = 400;
    message = 'SQL syntax error';
  }

  // Handle duplicate key errors
  if (err.message.includes('ER_DUP_ENTRY')) {
    statusCode = 409;
    message = 'Duplicate entry';
  }

  // Handle foreign key constraint errors
  if (err.message.includes('ER_ROW_IS_REFERENCED')) {
    statusCode = 409;
    message = 'Cannot delete or update: foreign key constraint fails';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
