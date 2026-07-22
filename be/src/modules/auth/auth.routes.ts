import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { type AuthenticatedRequest, requireAuth } from '../../auth/middleware.js';
import { hashPassword, isLegacyPasswordHash, verifyPassword } from '../../auth/password.js';
import { createAuthToken } from '../../auth/token.js';
import { writeAuditLog } from '../../db/audit.js';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../http/async-handler.js';
import { AppError } from '../../http/errors.js';

export const authRouter = Router();
const credentialsSchema = z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(8).max(100) });

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = credentialsSchema.parse(req.body);
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT u.user_id AS userId,u.username,u.password_hash AS passwordHash,u.role,u.status,
    e.employee_id AS employeeId,e.full_name AS fullName FROM users u LEFT JOIN employees e ON e.employee_id=u.employee_id WHERE u.username=? LIMIT 1`, [body.username]);
  const user = rows[0];
  if (!user || !(await verifyPassword(body.password, String(user.passwordHash)))) throw new AppError(401, 'Tên đăng nhập hoặc mật khẩu không đúng', 'INVALID_CREDENTIALS');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'Tài khoản đã bị khóa hoặc vô hiệu hóa', 'ACCOUNT_INACTIVE');
  if (isLegacyPasswordHash(String(user.passwordHash))) await pool.execute('UPDATE users SET password_hash=? WHERE user_id=?', [await hashPassword(body.password), user.userId]);
  await pool.execute('UPDATE users SET last_login_at=NOW() WHERE user_id=?', [user.userId]);
  const profile = { userId: Number(user.userId), username: String(user.username), role: user.role, employeeId: user.employeeId ? Number(user.employeeId) : null, fullName: user.fullName ?? null };
  res.json({ success: true, data: { token: createAuthToken({ userId: profile.userId, username: profile.username, role: profile.role }), user: profile } });
}));

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = credentialsSchema.extend({ employeeCode: z.string().trim().max(30).optional() }).parse(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let employeeId: number | null = null;
    if (body.employeeCode) {
      const [employees] = await connection.query<RowDataPacket[]>('SELECT employee_id AS employeeId FROM employees WHERE employee_code=? AND employment_status=\'ACTIVE\' LIMIT 1 FOR UPDATE', [body.employeeCode]);
      if (!employees[0]) throw new AppError(404, 'Không tìm thấy nhân viên đang làm với mã này', 'EMPLOYEE_NOT_FOUND');
      employeeId = Number(employees[0].employeeId);
      const [linked] = await connection.query<RowDataPacket[]>('SELECT user_id FROM users WHERE employee_id=? LIMIT 1', [employeeId]);
      if (linked[0]) throw new AppError(409, 'Nhân viên đã có tài khoản', 'EMPLOYEE_ACCOUNT_EXISTS');
    }
    const [result] = await connection.execute<ResultSetHeader>("INSERT INTO users(employee_id,username,password_hash,role,status) VALUES(?,?,?,'EMPLOYEE','ACTIVE')", [employeeId, body.username, await hashPassword(body.password)]);
    await writeAuditLog(connection, { action: 'ACCOUNT_REGISTERED', entityType: 'USER', entityId: result.insertId, after: { username: body.username, employeeId, role: 'EMPLOYEE' }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    await connection.commit();
    res.status(201).json({ success: true, data: { userId: result.insertId } });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT u.user_id AS userId,u.username,u.role,u.status,e.employee_id AS employeeId,e.full_name AS fullName
    FROM users u LEFT JOIN employees e ON e.employee_id=u.employee_id WHERE u.user_id=? LIMIT 1`, [auth.userId]);
  if (!rows[0] || rows[0].status !== 'ACTIVE') throw new AppError(401, 'Phiên đăng nhập không còn hợp lệ', 'SESSION_INVALID');
  res.json({ success: true, data: rows[0] });
}));
