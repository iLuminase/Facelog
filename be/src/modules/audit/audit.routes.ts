import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { requireAuth, requireRoles } from '../../auth/middleware.js';
import { pool } from '../../db/pool.js';
import { asyncHandler } from '../../http/async-handler.js';

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRoles('SUPER_ADMIN', 'HR_MANAGER'));

auditRouter.get('/', asyncHandler(async (req, res) => {
  const query = z.object({
    keyword: z.string().trim().max(150).optional(),
    action: z.string().trim().max(80).optional(),
    actionCode: z.enum(['ADD', 'UD', 'DEL', 'AUTH', 'ATT', 'SYS']).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
  }).parse(req.query);
  const filters: string[] = [];
  const params: unknown[] = [];
  if (query.keyword) {
    filters.push('(al.action LIKE ? OR al.entity_type LIKE ? OR al.entity_id LIKE ? OR al.before_json LIKE ? OR al.after_json LIKE ? OR al.ip_address LIKE ? OR u.username LIKE ?)');
    const keyword = `%${query.keyword}%`;
    params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
  }
  if (query.action) { filters.push('al.action = ?'); params.push(query.action); }
  if (query.actionCode) {
    const codeFilters = {
      ADD: "(al.action LIKE '%_CREATED' OR al.action LIKE '%_REGISTERED' OR al.action LIKE '%_ENROLLED')",
      UD: "(al.action LIKE '%_UPDATED' OR al.action LIKE '%_RESET' OR al.action LIKE '%_REPAIRED')",
      DEL: "(al.action LIKE '%_DELETED' OR al.action LIKE '%_DISABLED' OR al.action LIKE '%_DEACTIVATED')",
      AUTH: "al.action LIKE 'AUTH_%'",
      ATT: "(al.action LIKE 'ATTENDANCE_%' AND al.action NOT LIKE '%_DELETED')",
      SYS: "(al.action LIKE '%_AUTO_%' OR al.action='SEED_DATABASE')"
    } as const;
    filters.push(codeFilters[query.actionCode]);
  }
  const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.pageSize;
  const [[countRows], [rows]] = await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users u ON u.user_id=al.actor_user_id ${whereSql}`, params),
    pool.query<RowDataPacket[]>(`SELECT al.audit_log_id AS auditLogId,al.action,al.entity_type AS entityType,
      al.entity_id AS entityId,al.before_json AS beforeJson,al.after_json AS afterJson,
      al.ip_address AS ipAddress,al.user_agent AS userAgent,al.created_at AS createdAt,
      al.actor_user_id AS actorUserId,u.username AS actorUsername,u.role AS actorRole
      FROM audit_logs al LEFT JOIN users u ON u.user_id=al.actor_user_id ${whereSql}
      ORDER BY al.created_at DESC,al.audit_log_id DESC LIMIT ? OFFSET ?`,
      [...params, query.pageSize, offset])
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  res.json({ success: true, data: rows, pagination: {
    page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize)
  }});
}));
