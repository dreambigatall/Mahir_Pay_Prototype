import type { Pool } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import type { CreateStaffInput, Role, StaffMember } from "./staff.types";

export class StaffRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async list(limit: number, offset: number): Promise<{ items: StaffMember[]; total: number }> {
    const [items, count] = await Promise.all([
      this.pool.query<StaffMember>(
        `select u.id, u.email, u.full_name, u.title, u.room, u.status,
           u.must_change_password, u.created_at, u.updated_at,
           coalesce(array_agg(r.slug order by r.slug) filter (where r.slug is not null), '{}'::text[]) as roles
         from clinic.users u
         left join clinic.user_roles ur on ur.user_id = u.id
         left join clinic.roles r on r.id = ur.role_id
         group by u.id
         order by lower(u.full_name), u.id
         limit $1 offset $2`,
        [limit, offset],
      ),
      this.pool.query<{ total: string }>("select count(*)::text as total from clinic.users"),
    ]);
    return { items: items.rows, total: Number(count.rows[0]?.total ?? 0) };
  }

  async listRoles(): Promise<Role[]> {
    const result = await this.pool.query<Role>(
      "select slug, name, description from clinic.roles order by name",
    );
    return result.rows;
  }

  async listDoctors(): Promise<Array<{ id: string; full_name: string; title: string | null; room: string | null }>> {
    const result = await this.pool.query<{ id: string; full_name: string; title: string | null; room: string | null }>(
      `select u.id, u.full_name, u.title, u.room
       from clinic.users u
       join clinic.user_roles ur on ur.user_id = u.id
       join clinic.roles r on r.id = ur.role_id
       where u.status = 'active' and r.slug = 'doctor'
       order by lower(u.full_name), u.id`,
    );
    return result.rows;
  }

  async create(input: CreateStaffInput, auditEvent: AuditEventInput): Promise<StaffMember> {
    return withTransaction(this.pool, async (client) => {
      const roles = await client.query<{ id: string; slug: string }>(
        "select id::text, slug from clinic.roles where slug = any($1::text[])",
        [input.roleSlugs],
      );
      if (roles.rowCount !== input.roleSlugs.length) {
        throw new AppError(400, "ROLE_INVALID", "One or more roles do not exist");
      }
      const created = await client.query<{ id: string }>(
        `insert into clinic.users (email, password_hash, full_name, title, room)
         values (lower($1), $2, $3, $4, $5) returning id`,
        [input.email, input.passwordHash, input.fullName, input.title ?? null, input.room ?? null],
      );
      const userId = created.rows[0]!.id;
      await client.query(
        `insert into clinic.user_roles (user_id, role_id, assigned_by)
         select $1, id, $2 from clinic.roles where slug = any($3::text[])`,
        [userId, input.assignedBy, input.roleSlugs],
      );
      await this.audit.record(
        { ...auditEvent, resourceId: userId, afterData: { ...input, passwordHash: undefined } },
        client,
      );
      return (await this.findById(userId, client))!;
    });
  }

  async setStatus(
    userId: string,
    status: "active" | "disabled",
    auditEvent: AuditEventInput,
  ): Promise<StaffMember> {
    return withTransaction(this.pool, async (client) => {
      const before = await this.findById(userId, client);
      if (!before) throw new AppError(404, "STAFF_NOT_FOUND", "Staff member was not found");
      await client.query("update clinic.users set status = $2, updated_at = now() where id = $1", [userId, status]);
      if (status === "disabled") {
        await client.query(
          "update clinic.user_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1",
          [userId],
        );
      }
      const after = (await this.findById(userId, client))!;
      await this.audit.record({ ...auditEvent, resourceId: userId, beforeData: before, afterData: after }, client);
      return after;
    });
  }

  private async findById(userId: string, database: Queryable): Promise<StaffMember | null> {
    const result = await database.query<StaffMember>(
      `select u.id, u.email, u.full_name, u.title, u.room, u.status,
         u.must_change_password, u.created_at, u.updated_at,
         coalesce(array_agg(r.slug order by r.slug) filter (where r.slug is not null), '{}'::text[]) as roles
       from clinic.users u
       left join clinic.user_roles ur on ur.user_id = u.id
       left join clinic.roles r on r.id = ur.role_id
       where u.id = $1 group by u.id`,
      [userId],
    );
    return result.rows[0] ?? null;
  }
}
