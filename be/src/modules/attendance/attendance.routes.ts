import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { requireAuth, requireRoles, type AuthenticatedRequest } from '../../auth/middleware.js';
import { verifyAuthToken } from '../../auth/token.js';
import { writeAuditLog } from '../../db/audit.js';
import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../http/async-handler.js';
import { AppError } from '../../http/errors.js';
import { verifyFaceSchema } from '../faceid/faceid.schemas.js';
import { verifyFace } from '../faceid/faceid.service.js';

export const attendanceRouter = Router();

attendanceRouter.post(
  '/face-check',
  asyncHandler(async (req, res) => {
    const body = verifyFaceSchema
      .extend({
        eventType: z.enum(['AUTO', 'CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END']).default('AUTO'),
        debug: z.boolean().default(false)
      })
      .parse(req.body);
    const requiresAdmin = body.debug || body.eventType !== 'AUTO';
    const adminAuth = requiresAdmin
      ? verifyAuthToken(req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '')
      : null;
    if (requiresAdmin && !adminAuth) {
      throw new AppError(401, 'Chế độ debug/demo yêu cầu đăng nhập', 'ATTENDANCE_OVERRIDE_UNAUTHORIZED');
    }
    if (requiresAdmin && adminAuth?.role !== 'SUPER_ADMIN') {
      throw new AppError(403, 'Chỉ quản trị viên được điều khiển loại chấm công', 'ATTENDANCE_OVERRIDE_FORBIDDEN');
    }
    const verification = await verifyFace(body.descriptor, body.quality, body.liveness, body.deviceId);

    if (!verification.matched || !verification.match) {
      return res.status(422).json({
        success: false,
        code: verification.result,
        message: 'Không nhận diện được khuôn mặt',
        data: verification
      });
    }

    const employeeId = verification.match.employeeId;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [employeeRows] = await connection.query<RowDataPacket[]>(`
        SELECT employment_status AS employmentStatus, termination_date AS terminationDate
        FROM employees WHERE employee_id = ? LIMIT 1 FOR UPDATE`, [employeeId]);
      const employee = employeeRows[0];
      if (!employee || employee.employmentStatus !== 'ACTIVE' || (employee.terminationDate && new Date(employee.terminationDate) <= new Date())) {
        throw new AppError(403, 'Nhân viên không còn trạng thái làm việc hợp lệ', 'EMPLOYEE_NOT_ACTIVE');
      }
      const [openShiftRows] = await connection.query<RowDataPacket[]>(`
        SELECT s.shift_id AS shiftId,s.shift_name AS shiftName,
          TIME_FORMAT(s.start_time,'%H:%i') AS startTime,TIME_FORMAT(s.end_time,'%H:%i') AS endTime,
          DATE_FORMAT(ads.work_date,'%Y-%m-%d') AS workDate,
          TIMESTAMP(ads.work_date,s.start_time) AS shiftStartAt,
          CASE WHEN s.is_overnight=1 THEN DATE_ADD(TIMESTAMP(ads.work_date,s.end_time),INTERVAL 1 DAY)
            ELSE TIMESTAMP(ads.work_date,s.end_time) END AS shiftEndAt,
          CASE WHEN s.is_overnight=1
            THEN DATE_ADD(TIMESTAMP(ads.work_date,SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))),INTERVAL 1 DAY)
            ELSE TIMESTAMP(ads.work_date,SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))) END AS checkOutOpensAt,
          TIMESTAMPDIFF(SECOND,NOW(),CASE WHEN s.is_overnight=1
            THEN DATE_ADD(TIMESTAMP(ads.work_date,SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))),INTERVAL 1 DAY)
            ELSE TIMESTAMP(ads.work_date,SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))) END) AS secondsUntilCheckOut
        FROM attendance_daily_summary ads JOIN shifts s ON s.shift_id=ads.shift_id
        WHERE ads.employee_id=? AND ads.first_check_in IS NOT NULL AND ads.last_check_out IS NULL
          AND ads.work_date>=DATE_SUB(CURDATE(),INTERVAL 1 DAY)
        ORDER BY ads.first_check_in DESC LIMIT 1 FOR UPDATE`, [employeeId]);
      let assignedShift = openShiftRows[0];
      if (!assignedShift) {
        const [shiftRows] = await connection.query<RowDataPacket[]>(`
          SELECT candidates.*,
            TIMESTAMPDIFF(SECOND,NOW(),candidates.checkOutOpensAt) AS secondsUntilCheckOut
          FROM (
            SELECT s.shift_id AS shiftId,s.shift_name AS shiftName,
              TIME_FORMAT(s.start_time,'%H:%i') AS startTime,TIME_FORMAT(s.end_time,'%H:%i') AS endTime,
              DATE_FORMAT(DATE_ADD(CURDATE(),INTERVAL offsets.dayOffset DAY),'%Y-%m-%d') AS workDate,
              DATE_ADD(TIMESTAMP(CURDATE(),s.start_time),INTERVAL offsets.dayOffset DAY) AS shiftStartAt,
              CASE WHEN s.is_overnight=1
                THEN DATE_ADD(TIMESTAMP(CURDATE(),s.end_time),INTERVAL (offsets.dayOffset+1) DAY)
                ELSE DATE_ADD(TIMESTAMP(CURDATE(),s.end_time),INTERVAL offsets.dayOffset DAY) END AS shiftEndAt,
              CASE WHEN s.is_overnight=1
                THEN DATE_ADD(TIMESTAMP(CURDATE(),SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))),INTERVAL (offsets.dayOffset+1) DAY)
                ELSE DATE_ADD(TIMESTAMP(CURDATE(),SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))),INTERVAL offsets.dayOffset DAY) END AS checkOutOpensAt
            FROM shifts s CROSS JOIN (SELECT -1 AS dayOffset UNION ALL SELECT 0 UNION ALL SELECT 1) offsets
            WHERE s.is_active=1
          ) candidates
          WHERE NOW()>=DATE_SUB(candidates.shiftStartAt,INTERVAL ? MINUTE)
            AND NOW()<=candidates.checkOutOpensAt
          ORDER BY ABS(TIMESTAMPDIFF(SECOND,NOW(),candidates.shiftStartAt)),candidates.shiftStartAt DESC
          LIMIT 1`, [env.ATTENDANCE_EARLY_CHECK_IN_MINUTES]);
        assignedShift = shiftRows[0];
      }
      if (!assignedShift) throw new AppError(409, 'Hiện tại không nằm trong thời gian của ca làm nào', 'SHIFT_NOT_AVAILABLE_NOW');
      const [lastRows] = await connection.query<RowDataPacket[]>(
        `
        SELECT event_type AS eventType, event_time AS eventTime,
          TIMESTAMPDIFF(SECOND, event_time, NOW()) AS secondsAgo
        FROM attendance_logs
        WHERE employee_id = ? AND DATE(event_time) = CURDATE()
        ORDER BY event_time DESC, attendance_log_id DESC
        LIMIT 1 FOR UPDATE
        `,
        [employeeId]
      );
      const lastEvent = openShiftRows[0] ? { eventType: 'CHECK_IN', eventTime: openShiftRows[0].shiftStartAt, secondsAgo: lastRows[0]?.secondsAgo ?? 31 } : lastRows[0];
      if (!requiresAdmin && lastEvent && Number(lastEvent.secondsAgo) < 5) {
        throw new AppError(409, 'Nhân viên vừa chấm công, vui lòng thử lại sau 5 giây', 'DUPLICATE_ATTENDANCE');
      }

      if (!requiresAdmin && body.eventType === 'AUTO' && lastEvent?.eventType === 'CHECK_OUT') {
        throw new AppError(409, 'Nhân viên đã hoàn tất chấm công hôm nay', 'ATTENDANCE_ALREADY_COMPLETED');
      }

      if (!requiresAdmin && body.eventType === 'AUTO' && !lastEvent && Number(assignedShift.secondsUntilCheckOut) <= 0) {
        throw new AppError(409,
          `Đã qua thời gian chấm vào của ca ${assignedShift.shiftName} (${assignedShift.startTime} - ${assignedShift.endTime})`,
          'CHECK_IN_WINDOW_CLOSED');
      }

      if (!requiresAdmin && body.eventType === 'AUTO' && lastEvent?.eventType === 'CHECK_IN' && Number(assignedShift.secondsUntilCheckOut) > 0) {
        const openTime = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(assignedShift.checkOutOpensAt));
        throw new AppError(409, `Đã chấm giờ vào. Giờ ra được mở từ ${openTime}`, 'CHECK_OUT_NOT_OPEN');
      }

      const eventType = body.eventType === 'AUTO'
        ? !lastEvent || (body.debug && lastEvent.eventType === 'CHECK_OUT') ? 'CHECK_IN' : 'CHECK_OUT'
        : body.eventType;

      const [insertResult] = await connection.execute(
        `
        INSERT INTO attendance_logs (
          employee_id, device_id, event_type, event_time, method,
          recognition_confidence, liveness_score, face_quality_score, review_status
        )
        VALUES (?, ?, ?, NOW(), 'FACE_ID', ?, ?, ?, ?)
        `,
        [
          employeeId,
          body.deviceId ?? null,
          eventType,
          verification.match.confidence,
          verification.livenessScore,
          verification.qualityScore,
          verification.match.confidence >= verification.match.threshold ? 'AUTO_APPROVED' : 'NEEDS_REVIEW'
        ]
      );

      const [summaryRows] = await connection.query<RowDataPacket[]>(
        `
        WITH session_logs AS (
          SELECT * FROM attendance_logs WHERE employee_id=? AND event_time>=?
        ), latest_event AS (
          SELECT event_type AS eventType,event_time AS eventTime
          FROM session_logs WHERE event_type IN ('CHECK_IN','CHECK_OUT')
          ORDER BY event_time DESC,attendance_log_id DESC LIMIT 1
        ), canonical_events AS (
          SELECT
            CASE WHEN le.eventType='CHECK_IN' THEN le.eventTime ELSE (
              SELECT MAX(ci.event_time) FROM session_logs ci
              WHERE ci.event_type = 'CHECK_IN' AND ci.event_time <= le.eventTime
                AND ci.event_time > COALESCE((
                  SELECT MAX(previous.event_time) FROM session_logs previous
                  WHERE previous.event_type = 'CHECK_OUT' AND previous.event_time < le.eventTime
                ), '1970-01-01 00:00:00')
            ) END AS firstCheckIn,
            CASE WHEN le.eventType='CHECK_OUT' THEN le.eventTime ELSE NULL END AS lastCheckOut
          FROM latest_event le
        )
        SELECT
          ? AS workDate,
          s.shift_id AS shiftId,
          ce.firstCheckIn,
          ce.lastCheckOut,
          CASE WHEN ce.lastCheckOut IS NULL THEN 0 ELSE GREATEST(0,
            TIMESTAMPDIFF(MINUTE, ce.firstCheckIn, ce.lastCheckOut) -
              CASE WHEN TIMESTAMPDIFF(MINUTE, ce.firstCheckIn, ce.lastCheckOut) >= COALESCE(s.standard_work_minutes, 480)
                THEN COALESCE(s.break_minutes, 0) ELSE 0 END) END AS workedMinutes,
          CASE WHEN s.shift_id IS NULL THEN 0 ELSE GREATEST(0, TIMESTAMPDIFF(MINUTE,
            TIMESTAMP(?, ADDTIME(s.start_time, SEC_TO_TIME(s.late_grace_minutes * 60))),
            ce.firstCheckIn)) END AS lateMinutes,
          CASE WHEN s.shift_id IS NULL OR ce.lastCheckOut IS NULL THEN 0
            ELSE GREATEST(0, TIMESTAMPDIFF(MINUTE,
              ce.lastCheckOut,
              CASE WHEN s.is_overnight=1
                THEN DATE_ADD(TIMESTAMP(?, SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))),INTERVAL 1 DAY)
                ELSE TIMESTAMP(?, SUBTIME(s.end_time,SEC_TO_TIME(s.early_leave_grace_minutes*60))) END)) END AS earlyLeaveMinutes,
          CASE WHEN s.shift_id IS NULL OR ce.lastCheckOut IS NULL THEN 0
            ELSE GREATEST(0, TIMESTAMPDIFF(MINUTE, CASE WHEN s.is_overnight=1
              THEN DATE_ADD(TIMESTAMP(?,s.end_time),INTERVAL 1 DAY) ELSE TIMESTAMP(?,s.end_time) END,
              ce.lastCheckOut)) END AS overtimeMinutes
        FROM canonical_events ce
        JOIN shifts s ON s.shift_id=?
        LIMIT 1
        `,
        [employeeId, new Date(new Date(assignedShift.shiftStartAt).getTime() - env.ATTENDANCE_EARLY_CHECK_IN_MINUTES * 60_000),
          assignedShift.workDate, assignedShift.workDate, assignedShift.workDate, assignedShift.workDate,
          assignedShift.workDate, assignedShift.workDate, assignedShift.shiftId]
      );
      const summary = summaryRows[0];
      const status = !summary.lastCheckOut ? 'INCOMPLETE' : Number(summary.lateMinutes) > 0 ? 'LATE' : 'PRESENT';

      await connection.execute(
        `
        INSERT INTO attendance_daily_summary (
          employee_id, work_date, shift_id, first_check_in, last_check_out,
          worked_minutes, late_minutes, early_leave_minutes, overtime_minutes,
          missing_check_out, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          first_check_in = CASE
            WHEN VALUES(last_check_out) IS NOT NULL
              THEN COALESCE(attendance_daily_summary.first_check_in, VALUES(first_check_in))
            ELSE VALUES(first_check_in)
          END,
          last_check_out = VALUES(last_check_out), worked_minutes = VALUES(worked_minutes),
          late_minutes = VALUES(late_minutes), early_leave_minutes = VALUES(early_leave_minutes),
          overtime_minutes = VALUES(overtime_minutes), missing_check_out = VALUES(missing_check_out),
          status = VALUES(status)
        `,
        [employeeId, summary.workDate, summary.shiftId ?? null, summary.firstCheckIn, summary.lastCheckOut,
          summary.workedMinutes, summary.lateMinutes, summary.earlyLeaveMinutes, summary.overtimeMinutes,
          summary.lastCheckOut ? 0 : 1, status]
      );

      const attendanceLogId = Number('insertId' in insertResult ? insertResult.insertId : 0);
      await writeAuditLog(connection, {
        action: 'ATTENDANCE_RECORDED', entityType: 'ATTENDANCE_LOG', entityId: attendanceLogId,
        after: { employeeId, eventType, workDate: summary.workDate, debug: body.debug, demoOverride: body.eventType !== 'AUTO', adminActorUserId: adminAuth?.userId ?? null },
        ipAddress: req.ip, userAgent: req.get('user-agent')
      });
      await connection.commit();

      res.status(201).json({
        success: true,
        data: {
          attendanceLogId,
          eventType,
          eventTime: eventType === 'CHECK_OUT' ? summary.lastCheckOut : summary.firstCheckIn,
          shift: assignedShift,
          employee: verification.match,
          verification,
          summary: { ...summary, status },
          ...(body.debug ? {
            debug: {
              enabled: true,
              actor: { userId: adminAuth!.userId, username: adminAuth!.username, role: adminAuth!.role },
              bypassedRules: ['DUPLICATE_ATTENDANCE', 'ATTENDANCE_ALREADY_COMPLETED', 'CHECK_OUT_NOT_OPEN'],
              serverTime: new Date().toISOString()
            }
          } : {})
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

attendanceRouter.get(
  '/daily-report',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'SECURITY'),
  asyncHandler(async (req, res) => {
    const query = z.object({
      keyword: z.string().trim().max(150).optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
      departmentId: z.coerce.number().int().positive().optional(),
      status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'HOLIDAY', 'INCOMPLETE']).optional(),
      sortBy: z.enum(['updatedAt', 'workDate', 'firstCheckIn', 'lastCheckOut', 'employeeCode', 'fullName', 'departmentName', 'status', 'lateMinutes']).default('workDate'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20)
    }).refine((value) => !value.from || !value.to || value.from <= value.to, {
      message: 'Ngày bắt đầu phải trước ngày kết thúc', path: ['from']
    }).parse(req.query);

    const filters: string[] = [];
    const params: unknown[] = [];
    if (query.keyword) {
      filters.push('(e.employee_code LIKE ? OR e.full_name LIKE ? OR e.email LIKE ?)');
      const keyword = `%${query.keyword}%`;
      params.push(keyword, keyword, keyword);
    }
    if (query.from) { filters.push('ads.work_date >= ?'); params.push(query.from); }
    if (query.to) { filters.push('ads.work_date <= ?'); params.push(query.to); }
    if (query.departmentId) { filters.push('e.department_id = ?'); params.push(query.departmentId); }
    if (query.status) { filters.push('ads.status = ?'); params.push(query.status); }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const sortColumns = {
      updatedAt: 'ads.updated_at', workDate: 'ads.work_date', firstCheckIn: 'ads.first_check_in', lastCheckOut: 'ads.last_check_out', employeeCode: 'e.employee_code', fullName: 'e.full_name',
      departmentName: 'd.department_name', status: 'ads.status', lateMinutes: 'ads.late_minutes'
    } as const;
    const offset = (query.page - 1) * query.pageSize;
    const fromSql = `
      FROM attendance_daily_summary ads
      JOIN employees e ON e.employee_id = ads.employee_id
      LEFT JOIN departments d ON d.department_id = e.department_id
      LEFT JOIN positions p ON p.position_id = e.position_id
      LEFT JOIN shifts s ON s.shift_id = ads.shift_id
      ${whereSql}`;

    const [[countRow], [rows], [statsRows], [dailyRows]] = await Promise.all([
      pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total ${fromSql}`, params),
      pool.query<RowDataPacket[]>(`
        SELECT ads.summary_id AS summaryId, DATE_FORMAT(ads.work_date, '%Y-%m-%d') AS workDate,
          e.employee_id AS employeeId, e.employee_code AS employeeCode, e.full_name AS fullName,
          d.department_name AS departmentName, p.position_name AS positionName, s.shift_name AS shiftName,
          ads.first_check_in AS firstCheckIn, ads.last_check_out AS lastCheckOut,
          ads.worked_minutes AS workedMinutes, ads.late_minutes AS lateMinutes,
          ads.early_leave_minutes AS earlyLeaveMinutes, ads.overtime_minutes AS overtimeMinutes,
          ads.status, ads.approval_status AS approvalStatus, ads.updated_at AS updatedAt
        ${fromSql}
        ORDER BY ${sortColumns[query.sortBy]} ${query.sortOrder.toUpperCase()}
          ${query.sortBy === 'workDate' ? ', ads.updated_at DESC, COALESCE(ads.last_check_out, ads.first_check_in) DESC' : ''},
          e.employee_code ASC
        LIMIT ? OFFSET ?`, [...params, query.pageSize, offset]),
      pool.query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS totalRecords,
          SUM(CASE WHEN ads.status='PRESENT' THEN 1 ELSE 0 END) AS presentCount,
          SUM(CASE WHEN ads.status='LATE' OR ads.late_minutes>0 THEN 1 ELSE 0 END) AS lateCount,
          SUM(CASE WHEN ads.status='INCOMPLETE' OR ads.last_check_out IS NULL THEN 1 ELSE 0 END) AS incompleteCount,
          SUM(CASE WHEN ads.early_leave_minutes>0 THEN 1 ELSE 0 END) AS earlyLeaveCount,
          SUM(CASE WHEN ads.overtime_minutes>0 THEN 1 ELSE 0 END) AS overtimeCount,
          COALESCE(SUM(ads.late_minutes),0) AS totalLateMinutes,
          COALESCE(ROUND(AVG(ads.worked_minutes)),0) AS averageWorkedMinutes
        ${fromSql}`, params),
      pool.query<RowDataPacket[]>(`
        SELECT DATE_FORMAT(ads.work_date,'%Y-%m-%d') AS workDate,
          COUNT(*) AS total,
          SUM(CASE WHEN ads.status='LATE' OR ads.late_minutes>0 THEN 1 ELSE 0 END) AS lateCount,
          SUM(CASE WHEN ads.status='INCOMPLETE' OR ads.last_check_out IS NULL THEN 1 ELSE 0 END) AS incompleteCount,
          SUM(CASE WHEN ads.early_leave_minutes>0 THEN 1 ELSE 0 END) AS earlyLeaveCount
        ${fromSql}
        GROUP BY ads.work_date
        ORDER BY ads.work_date DESC
        LIMIT 14`, params)
    ]);
    const total = Number(countRow[0]?.total ?? 0);
    const stats = statsRows[0] ?? {};
    res.json({
      success: true, data: rows, pagination: {
        page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize)
      }, analytics: {
        totalRecords: Number(stats.totalRecords ?? 0),
        presentCount: Number(stats.presentCount ?? 0),
        lateCount: Number(stats.lateCount ?? 0),
        incompleteCount: Number(stats.incompleteCount ?? 0),
        earlyLeaveCount: Number(stats.earlyLeaveCount ?? 0),
        overtimeCount: Number(stats.overtimeCount ?? 0),
        totalLateMinutes: Number(stats.totalLateMinutes ?? 0),
        averageWorkedMinutes: Number(stats.averageWorkedMinutes ?? 0),
        daily: dailyRows.reverse().map((row) => ({
          workDate: String(row.workDate), total: Number(row.total ?? 0),
          lateCount: Number(row.lateCount ?? 0), incompleteCount: Number(row.incompleteCount ?? 0),
          earlyLeaveCount: Number(row.earlyLeaveCount ?? 0)
        }))
      }
    });
  })
);

attendanceRouter.delete(
  '/sessions/:employeeId/:workDate',
  requireAuth,
  requireRoles('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { employeeId, workDate } = z.object({
      employeeId: z.coerce.number().int().positive(),
      workDate: z.string().date()
    }).parse(req.params);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [employeeRows] = await connection.query<RowDataPacket[]>(
        'SELECT employee_code AS employeeCode, full_name AS fullName FROM employees WHERE employee_id = ? LIMIT 1',
        [employeeId]
      );
      const [summaryRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM attendance_daily_summary WHERE employee_id = ? AND work_date = ? LIMIT 1 FOR UPDATE',
        [employeeId, workDate]
      );
      const [logRows] = await connection.query<RowDataPacket[]>(`
        SELECT attendance_log_id AS attendanceLogId, event_type AS eventType, event_time AS eventTime
        FROM attendance_logs WHERE employee_id = ? AND DATE(event_time) = ?
        ORDER BY event_time FOR UPDATE`, [employeeId, workDate]);
      if (!summaryRows[0] && !logRows.length) {
        throw new AppError(404, 'Không tìm thấy phiên chấm công để xóa', 'ATTENDANCE_SESSION_NOT_FOUND');
      }
      await connection.execute('DELETE FROM attendance_logs WHERE employee_id = ? AND DATE(event_time) = ?', [employeeId, workDate]);
      await connection.execute('DELETE FROM attendance_daily_summary WHERE employee_id = ? AND work_date = ?', [employeeId, workDate]);
      await writeAuditLog(connection, {
        actorUserId: (req as AuthenticatedRequest).auth.userId,
        action: 'ATTENDANCE_SESSION_DELETED', entityType: 'ATTENDANCE_SESSION', entityId: `${employeeId}:${workDate}`,
        before: { employee: employeeRows[0] ?? { employeeId }, summary: summaryRows[0] ?? null, logs: logRows },
        after: { employeeId, workDate, deletedLogCount: logRows.length },
        ipAddress: req.ip, userAgent: req.get('user-agent')
      });
      await connection.commit();
      res.json({ success: true, data: { employeeId, workDate, deletedLogCount: logRows.length } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

attendanceRouter.get(
  '/sessions/:employeeId/:workDate',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'SECURITY'),
  asyncHandler(async (req, res) => {
    const { employeeId, workDate } = z.object({
      employeeId: z.coerce.number().int().positive(), workDate: z.string().date()
    }).parse(req.params);
    const [[employees], [summaries], [logs], [attempts]] = await Promise.all([
      pool.query<RowDataPacket[]>(`SELECT e.employee_id AS employeeId,e.employee_code AS employeeCode,e.full_name AS fullName,
        e.gender,DATE_FORMAT(e.date_of_birth,'%Y-%m-%d') AS dateOfBirth,e.email,e.phone,e.address,
        d.department_name AS departmentName,p.position_name AS positionName,e.employment_type AS employmentType,
        e.employment_status AS employmentStatus,DATE_FORMAT(e.hire_date,'%Y-%m-%d') AS hireDate
        FROM employees e LEFT JOIN departments d ON d.department_id=e.department_id
        LEFT JOIN positions p ON p.position_id=e.position_id WHERE e.employee_id=? LIMIT 1`, [employeeId]),
      pool.query<RowDataPacket[]>(`SELECT ads.*,s.shift_code AS shiftCode,s.shift_name AS shiftName,
        TIME_FORMAT(s.start_time,'%H:%i') AS shiftStartTime,TIME_FORMAT(s.end_time,'%H:%i') AS shiftEndTime,
        s.early_leave_grace_minutes AS earlyLeaveGraceMinutes
        FROM attendance_daily_summary ads LEFT JOIN shifts s ON s.shift_id=ads.shift_id
        WHERE ads.employee_id=? AND ads.work_date=? LIMIT 1`, [employeeId, workDate]),
      pool.query<RowDataPacket[]>(`SELECT al.attendance_log_id AS attendanceLogId,al.event_type AS eventType,
        al.event_time AS eventTime,al.method,al.recognition_confidence AS recognitionConfidence,
        al.liveness_score AS livenessScore,al.face_quality_score AS faceQualityScore,al.review_status AS reviewStatus,
        al.note,d.device_id AS deviceId,d.device_code AS deviceCode,d.device_name AS deviceName,
        d.device_type AS deviceType,d.location_name AS locationName,d.ip_address AS deviceIp,d.status AS deviceStatus
        FROM attendance_logs al LEFT JOIN devices d ON d.device_id=al.device_id
        WHERE al.employee_id=? AND DATE(al.event_time)=? ORDER BY al.event_time`, [employeeId, workDate]),
      pool.query<RowDataPacket[]>(`SELECT ra.recognition_attempt_id AS attemptId,ra.attempted_at AS attemptedAt,
        ra.result,ra.confidence,ra.liveness_score AS livenessScore,ra.face_quality_score AS faceQualityScore,
        ra.threshold,ra.processing_ms AS processingMs,ra.error_message AS errorMessage,
        d.device_code AS deviceCode,d.device_name AS deviceName,d.location_name AS locationName,d.ip_address AS deviceIp
        FROM recognition_attempts ra LEFT JOIN devices d ON d.device_id=ra.device_id
        WHERE ra.employee_id=? AND DATE(ra.attempted_at)=? ORDER BY ra.attempted_at`, [employeeId, workDate])
    ]);
    if (!employees[0] || (!summaries[0] && !logs.length)) {
      throw new AppError(404, 'Không tìm thấy chi tiết phiên chấm công', 'ATTENDANCE_SESSION_NOT_FOUND');
    }
    res.json({ success: true, data: { employee: employees[0], summary: summaries[0] ?? null, logs, recognitionAttempts: attempts } });
  })
);
