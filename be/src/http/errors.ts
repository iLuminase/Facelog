import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'APP_ERROR'
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const invalidField = firstIssue?.path.length ? firstIssue.path.join('.') : 'payload';
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: `Dữ liệu gửi lên không hợp lệ tại trường ${invalidField}`,
      issues: error.issues
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_DATA',
        message: 'Mã nhân viên hoặc email đã tồn tại'
      });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REFERENCE',
        message: 'Phòng ban hoặc chức vụ không hợp lệ'
      });
    }
    if (error.code === 'ER_SIGNAL_EXCEPTION') {
      return res.status(400).json({
        success: false,
        code: 'EMPLOYMENT_DATE_CONSTRAINT',
        message: 'Ngày nghỉ việc và trạng thái làm việc không hợp lệ'
      });
    }
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error';
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message
  });
}
