import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { requireAuth, requireRoles } from '../../auth/middleware.js';
import { writeAuditLog } from '../../db/audit.js';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../http/async-handler.js';
import { AppError } from '../../http/errors.js';

export const employeeRouter = Router();
employeeRouter.use(requireAuth, requireRoles('SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF'));

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const employeeSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z.string().date(),
  email: z.union([z.string().trim().email().max(150), z.literal('')]).optional().nullable().transform((value) => value || null),
  phone: optionalText(30),
  address: optionalText(500),
  departmentId: z.number().int().positive().optional().nullable(),
  positionId: z.number().int().positive().optional().nullable(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACTOR']).default('FULL_TIME'),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED']).default('ACTIVE'),
  hireDate: z.string().date(),
  terminationDate: z.string().date().optional().nullable(),
  note: optionalText(1000)
});

function generateEmployeeCode(fullName: string, dateOfBirth: string) {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length < 2) {
    throw new AppError(400, 'Họ tên phải có ít nhất họ và tên để tạo mã nhân viên', 'EMPLOYEE_NAME_REQUIRED');
  }
  const initial = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (character) => character === 'Đ' ? 'D' : 'd')
    .replace(/[^a-zA-Z]/g, '')
    .charAt(0)
    .toUpperCase();
  const initials = [nameParts.at(-1)!, nameParts[0], ...nameParts.slice(1, -1)]
    .map(initial)
    .join('');
  if (initials.length !== nameParts.length) {
    throw new AppError(400, 'Họ tên chứa thành phần không thể tạo mã nhân viên', 'INVALID_EMPLOYEE_NAME');
  }
  const [year, month, day] = dateOfBirth.split('-');
  return `${initials}0${day}${month}${year.slice(-2)}`;
}

function validateEmploymentDates(body: z.infer<typeof employeeSchema>) {
  if (body.terminationDate && body.terminationDate < body.hireDate) {
    throw new AppError(400, 'Ngày nghỉ việc không được trước ngày vào làm', 'INVALID_TERMINATION_DATE');
  }
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const today = now.toISOString().slice(0, 10);
  if (body.employmentStatus === 'RESIGNED' && !body.terminationDate) {
    throw new AppError(400, 'Nhân viên đã nghỉ phải có ngày nghỉ việc', 'TERMINATION_DATE_REQUIRED');
  }
  if (body.terminationDate && body.terminationDate <= today && body.employmentStatus !== 'RESIGNED') {
    throw new AppError(400, 'Ngày nghỉ việc đã đến hạn, trạng thái phải là Đã nghỉ', 'EMPLOYMENT_STATUS_MISMATCH');
  }
  if (body.employmentStatus === 'RESIGNED' && body.terminationDate && body.terminationDate > today) {
    throw new AppError(400, 'Ngày nghỉ việc trong tương lai chưa thể đặt trạng thái Đã nghỉ', 'FUTURE_TERMINATION_DATE');
  }
}

async function syncExpiredEmployees(req: { ip?: string; get(name: string): string | undefined }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [expiredRows] = await connection.query<RowDataPacket[]>(`
      SELECT employee_id AS employeeId, employment_status AS employmentStatus, termination_date AS terminationDate
      FROM employees WHERE termination_date IS NOT NULL AND termination_date <= CURDATE()
        AND employment_status <> 'RESIGNED' FOR UPDATE`);
    for (const employee of expiredRows) {
      await connection.execute("UPDATE employees SET employment_status = 'RESIGNED' WHERE employee_id = ?", [employee.employeeId]);
      await connection.execute("UPDATE face_profiles SET status = 'DISABLED' WHERE employee_id = ?", [employee.employeeId]);
      await writeAuditLog(connection, { action: 'EMPLOYEE_AUTO_RESIGNED', entityType: 'EMPLOYEE', entityId: employee.employeeId,
        before: employee, after: { employmentStatus: 'RESIGNED' }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

const employeeSelect = `
  SELECT e.employee_id AS employeeId, e.employee_code AS employeeCode, e.full_name AS fullName,
    e.gender, DATE_FORMAT(e.date_of_birth, '%Y-%m-%d') AS dateOfBirth, e.email, e.phone, e.address,
    e.department_id AS departmentId, d.department_name AS departmentName,
    e.position_id AS positionId, p.position_name AS positionName,
    e.employment_type AS employmentType, e.employment_status AS employmentStatus,
    DATE_FORMAT(e.hire_date, '%Y-%m-%d') AS hireDate,
    DATE_FORMAT(e.termination_date, '%Y-%m-%d') AS terminationDate, e.note,
    fp.status AS faceStatus, fp.quality_score AS faceQualityScore,
    e.created_at AS createdAt, e.updated_at AS updatedAt
  FROM employees e
  LEFT JOIN departments d ON d.department_id = e.department_id
  LEFT JOIN positions p ON p.position_id = e.position_id
  LEFT JOIN face_profiles fp ON fp.employee_id = e.employee_id`;

employeeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await syncExpiredEmployees(req);
    const query = z.object({
      keyword: z.string().trim().max(150).optional(),
      departmentId: z.coerce.number().int().positive().optional(),
      status: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED']).optional(),
      sortBy: z.enum(['employeeCode', 'fullName', 'departmentName', 'positionName', 'employmentStatus', 'hireDate']).default('employeeCode'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20)
    }).parse(req.query);
    const filters: string[] = [];
    const params: unknown[] = [];
    if (query.keyword) {
      filters.push('(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.email LIKE ? OR e.phone LIKE ?)');
      const keyword = `%${query.keyword}%`;
      params.push(keyword, keyword, keyword, keyword);
    }
    if (query.departmentId) { filters.push('e.department_id = ?'); params.push(query.departmentId); }
    if (query.status) { filters.push('e.employment_status = ?'); params.push(query.status); }
    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const sortColumns = {
      employeeCode: 'e.employee_code', fullName: 'e.full_name', departmentName: 'd.department_name',
      positionName: 'p.position_name', employmentStatus: 'e.employment_status', hireDate: 'e.hire_date'
    } as const;
    const offset = (query.page - 1) * query.pageSize;
    const [[countRows], [rows]] = await Promise.all([
      pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM employees e ${whereSql}`, params),
      pool.query<RowDataPacket[]>(`${employeeSelect} ${whereSql}
        ORDER BY ${sortColumns[query.sortBy]} ${query.sortOrder.toUpperCase()}, e.employee_id ASC LIMIT ? OFFSET ?`,
        [...params, query.pageSize, offset])
    ]);
    const total = Number(countRows[0]?.total ?? 0);
    res.json({ success: true, data: rows, pagination: {
      page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize)
    }});
  })
);

employeeRouter.get('/meta', asyncHandler(async (_req, res) => {
  const [[departments], [positions]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT department_id AS departmentId, department_name AS departmentName FROM departments WHERE is_active = 1 ORDER BY department_name'),
    pool.query<RowDataPacket[]>('SELECT position_id AS positionId, position_name AS positionName FROM positions WHERE is_active = 1 ORDER BY position_name')
  ]);
  res.json({ success: true, data: { departments, positions } });
}));

employeeRouter.post('/', asyncHandler(async (req, res) => {
  const body = employeeSchema.parse(req.body);
  const employeeCode = generateEmployeeCode(body.fullName, body.dateOfBirth);
  validateEmploymentDates(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [codeRows] = await connection.query<RowDataPacket[]>(
      'SELECT employee_id FROM employees WHERE employee_code = ? LIMIT 1 FOR UPDATE',
      [employeeCode]
    );
    if (codeRows[0]) {
      throw new AppError(409, `Mã nhân viên ${employeeCode} đã tồn tại (trùng họ tên và ngày sinh)`, 'EMPLOYEE_CODE_CONFLICT');
    }
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO employees (employee_code, full_name, gender, date_of_birth, email, phone, address,
        department_id, position_id, employment_type, employment_status, hire_date, termination_date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeCode, body.fullName, body.gender ?? null, body.dateOfBirth, body.email, body.phone,
        body.address, body.departmentId ?? null, body.positionId ?? null, body.employmentType,
        body.employmentStatus, body.hireDate, body.terminationDate ?? null, body.note]);
    await connection.execute('INSERT INTO face_profiles (employee_id, status) VALUES (?, ?)', [result.insertId, 'NOT_ENROLLED']);
    await connection.execute(`
      INSERT INTO employee_shift_assignments (employee_id, shift_id, effective_from, repeat_type, is_active)
      SELECT ?, shift_id, ?, 'WEEKDAYS', 1 FROM shifts WHERE is_active = 1 ORDER BY shift_id LIMIT 1`,
      [result.insertId, body.hireDate]);
    await writeAuditLog(connection, { action: 'EMPLOYEE_CREATED', entityType: 'EMPLOYEE', entityId: result.insertId,
      after: { ...body, employeeCode }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    await connection.commit();
    res.status(201).json({ success: true, data: { employeeId: result.insertId, employeeCode } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

employeeRouter.get('/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = z.object({ employeeId: z.coerce.number().int().positive() }).parse(req.params);
  const [rows] = await pool.query<RowDataPacket[]>(`${employeeSelect} WHERE e.employee_id = ? LIMIT 1`, [employeeId]);
  if (!rows[0]) throw new AppError(404, 'Không tìm thấy nhân viên', 'EMPLOYEE_NOT_FOUND');
  res.json({ success: true, data: rows[0] });
}));

employeeRouter.put('/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = z.object({ employeeId: z.coerce.number().int().positive() }).parse(req.params);
  const body = employeeSchema.parse(req.body);
  const employeeCode = generateEmployeeCode(body.fullName, body.dateOfBirth);
  validateEmploymentDates(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.query<RowDataPacket[]>('SELECT * FROM employees WHERE employee_id = ? LIMIT 1 FOR UPDATE', [employeeId]);
    if (!beforeRows[0]) throw new AppError(404, 'Không tìm thấy nhân viên', 'EMPLOYEE_NOT_FOUND');
    const [codeRows] = await connection.query<RowDataPacket[]>(
      'SELECT employee_id FROM employees WHERE employee_code = ? AND employee_id <> ? LIMIT 1 FOR UPDATE',
      [employeeCode, employeeId]
    );
    if (codeRows[0]) {
      throw new AppError(409, `Mã nhân viên ${employeeCode} đã tồn tại (trùng họ tên và ngày sinh)`, 'EMPLOYEE_CODE_CONFLICT');
    }
    await connection.execute(`UPDATE employees SET employee_code = ?, full_name = ?, gender = ?, date_of_birth = ?,
      email = ?, phone = ?, address = ?, department_id = ?, position_id = ?, employment_type = ?,
      employment_status = ?, hire_date = ?, termination_date = ?, note = ? WHERE employee_id = ?`,
      [employeeCode, body.fullName, body.gender ?? null, body.dateOfBirth, body.email, body.phone,
        body.address, body.departmentId ?? null, body.positionId ?? null, body.employmentType,
        body.employmentStatus, body.hireDate, body.terminationDate ?? null, body.note, employeeId]);
    await writeAuditLog(connection, { action: 'EMPLOYEE_UPDATED', entityType: 'EMPLOYEE', entityId: employeeId,
      before: beforeRows[0], after: { ...body, employeeCode }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    await connection.commit();
    res.json({ success: true, data: { employeeId, employeeCode } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

employeeRouter.delete('/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = z.object({ employeeId: z.coerce.number().int().positive() }).parse(req.params);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.query<RowDataPacket[]>('SELECT * FROM employees WHERE employee_id = ? LIMIT 1 FOR UPDATE', [employeeId]);
    if (!beforeRows[0]) throw new AppError(404, 'Không tìm thấy nhân viên', 'EMPLOYEE_NOT_FOUND');
    await connection.execute("UPDATE employees SET employment_status = 'RESIGNED', termination_date = CURDATE() WHERE employee_id = ?", [employeeId]);
    await connection.execute("UPDATE face_profiles SET status = 'DISABLED' WHERE employee_id = ?", [employeeId]);
    await writeAuditLog(connection, { action: 'EMPLOYEE_DEACTIVATED', entityType: 'EMPLOYEE', entityId: employeeId,
      before: beforeRows[0], after: { employmentStatus: 'RESIGNED' }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    await connection.commit();
    res.json({ success: true, data: { employeeId } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));
