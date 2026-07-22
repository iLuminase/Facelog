import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../http/errors.js';
import type { AuthPayload, AuthRole } from './token.js';
import { verifyAuthToken } from './token.js';

export type AuthenticatedRequest = Request & { auth: AuthPayload };

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) return next(new AppError(401, 'Vui lòng đăng nhập để tiếp tục', 'UNAUTHORIZED'));
  (req as AuthenticatedRequest).auth = payload;
  next();
}

export function requireRoles(...roles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth || !roles.includes(auth.role)) return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này', 'FORBIDDEN'));
    next();
  };
}
