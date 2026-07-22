import type { PoolConnection } from 'mysql2/promise';

export type AuditEntry = {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(connection: PoolConnection, entry: AuditEntry) {
  await connection.execute(
    `
    INSERT INTO audit_logs (
      actor_user_id, action, entity_type, entity_id,
      before_json, after_json, ip_address, user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.actorUserId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId == null ? null : String(entry.entityId),
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      entry.ipAddress ?? null,
      entry.userAgent ?? null
    ]
  );
}
