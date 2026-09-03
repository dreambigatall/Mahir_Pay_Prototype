import type { Queryable } from "../../database/types";

export type RequestMetadata = {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type AuditEventInput = RequestMetadata & {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
};

export class AuditRepository {
  constructor(private readonly database: Queryable) {}

  async record(event: AuditEventInput, database: Queryable = this.database): Promise<void> {
    await database.query(
      `
        insert into clinic.audit_events (
          actor_user_id, action, resource_type, resource_id, request_id,
          before_data, after_data, metadata, ip_address, user_agent
        ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
      `,
      [
        event.actorUserId ?? null,
        event.action,
        event.resourceType,
        event.resourceId ?? null,
        event.requestId,
        event.beforeData === undefined ? null : JSON.stringify(event.beforeData),
        event.afterData === undefined ? null : JSON.stringify(event.afterData),
        JSON.stringify(event.metadata ?? {}),
        event.ipAddress ?? null,
        event.userAgent ?? null,
      ],
    );
  }
}
