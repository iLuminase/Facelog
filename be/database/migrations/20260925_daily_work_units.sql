USE facelog_db;

-- One full attendance day is worth two work units. Minutes remain detail only.
ALTER TABLE attendance_daily_summary
  ADD COLUMN work_units DECIMAL(4,2) NOT NULL DEFAULT 0 AFTER worked_minutes;

-- Backfill completed sessions from the seed database.
UPDATE attendance_daily_summary
SET work_units = CASE
  WHEN first_check_in IS NOT NULL AND last_check_out IS NOT NULL THEN 2.00
  ELSE 0.00
END;

-- Close previous-day open sessions after their assigned shift has ended.
UPDATE attendance_daily_summary ads
JOIN shifts s ON s.shift_id = ads.shift_id
SET
  ads.last_check_out = CASE WHEN s.is_overnight = 1
    THEN DATE_ADD(TIMESTAMP(ads.work_date, s.end_time), INTERVAL 1 DAY)
    ELSE TIMESTAMP(ads.work_date, s.end_time) END,
  ads.worked_minutes = GREATEST(0, TIMESTAMPDIFF(MINUTE, ads.first_check_in,
    CASE WHEN s.is_overnight = 1
      THEN DATE_ADD(TIMESTAMP(ads.work_date, s.end_time), INTERVAL 1 DAY)
      ELSE TIMESTAMP(ads.work_date, s.end_time) END
  ) - CASE WHEN TIMESTAMPDIFF(MINUTE, ads.first_check_in,
    CASE WHEN s.is_overnight = 1
      THEN DATE_ADD(TIMESTAMP(ads.work_date, s.end_time), INTERVAL 1 DAY)
      ELSE TIMESTAMP(ads.work_date, s.end_time) END
  ) >= COALESCE(s.standard_work_minutes, 480) THEN COALESCE(s.break_minutes, 0) ELSE 0 END),
  ads.early_leave_minutes = 0,
  ads.overtime_minutes = 0,
  ads.work_units = 2.00,
  ads.missing_check_out = 0,
  ads.status = CASE WHEN ads.late_minutes > 0 THEN 'LATE' ELSE 'PRESENT' END
WHERE ads.first_check_in IS NOT NULL
  AND ads.last_check_out IS NULL
  AND ads.work_date < CURDATE()
  AND NOW() >= CASE WHEN s.is_overnight = 1
    THEN DATE_ADD(TIMESTAMP(ads.work_date, s.end_time), INTERVAL 1 DAY)
    ELSE TIMESTAMP(ads.work_date, s.end_time) END;

CREATE OR REPLACE VIEW v_attendance_daily_report AS
SELECT
  ads.summary_id,
  ads.work_date,
  e.employee_code,
  e.full_name,
  d.department_code,
  d.department_name,
  p.position_name,
  s.shift_code,
  s.shift_name,
  s.start_time AS shift_start_time,
  s.end_time AS shift_end_time,
  ads.first_check_in,
  ads.last_check_out,
  ads.worked_minutes,
  ads.work_units,
  ads.late_minutes,
  ads.early_leave_minutes,
  ads.overtime_minutes,
  ads.missing_check_out,
  ads.status,
  ads.approval_status,
  ads.note
FROM attendance_daily_summary ads
JOIN employees e ON e.employee_id = ads.employee_id
LEFT JOIN departments d ON d.department_id = e.department_id
LEFT JOIN positions p ON p.position_id = e.position_id
LEFT JOIN shifts s ON s.shift_id = ads.shift_id;
