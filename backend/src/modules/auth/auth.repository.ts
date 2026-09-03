import type { Queryable } from "../../database/types";
import type { RequestMetadata } from "../audit/audit.repository";
import type { SessionCreation, SessionPrincipal, UserWithAccess } from "./auth.types";

export interface AuthStore {
  findUserByEmail(email: string): Promise<UserWithAccess | null>;
  findUserById(userId: string): Promise<UserWithAccess | null>;
  recordFailedLogin(user: UserWithAccess | null, email: string, metadata: RequestMetadata): Promise<void>;
  recordSuccessfulLogin(userId: string, email: string, metadata: RequestMetadata): Promise<void>;
  createSession(session: SessionCreation): Promise<void>;
  findPrincipalByTokenHash(tokenHash: string): Promise<SessionPrincipal | null>;
  touchSession(sessionId: string, idleMinutes: number): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  changePasswordAndRevokeSessions(userId: string, passwordHash: string): Promise<void>;
}

const USER_WITH_ACCESS_SQL = `
  select u.id, u.email, u.password_hash, u.full_name, u.title, u.room, u.status,
    u.must_change_password, u.failed_login_count, u.locked_until,
    coalesce(array_agg(distinct r.slug) filter (where r.slug is not null), '{}'::text[]) as roles,
    coalesce(array_agg(distinct p.slug) filter (where p.slug is not null), '{}'::text[]) as permissions
  from clinic.users u
  left join clinic.user_roles ur on ur.user_id = u.id
  left join clinic.roles r on r.id = ur.role_id
  left join clinic.role_permissions rp on rp.role_id = r.id
  left join clinic.permissions p on p.id = rp.permission_id
`;

export class AuthRepository implements AuthStore {
  constructor(private readonly database: Queryable) {}

  async findUserByEmail(email: string): Promise<UserWithAccess | null> {
    const result = await this.database.query<UserWithAccess>(
      `${USER_WITH_ACCESS_SQL} where lower(u.email) = lower($1) group by u.id`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findUserById(userId: string): Promise<UserWithAccess | null> {
    const result = await this.database.query<UserWithAccess>(
      `${USER_WITH_ACCESS_SQL} where u.id = $1 group by u.id`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async recordFailedLogin(
    user: UserWithAccess | null,
    email: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    if (user) {
      await this.database.query(
        `update clinic.users
         set failed_login_count = failed_login_count + 1,
             locked_until = case when failed_login_count + 1 >= 5
               then now() + interval '15 minutes' else locked_until end,
             updated_at = now()
         where id = $1`,
        [user.id],
      );
    }
    await this.database.query(
      `insert into clinic.login_attempts
        (user_id, email, successful, failure_reason, ip_address, user_agent)
       values ($1, $2, false, 'invalid_credentials', $3, $4)`,
      [user?.id ?? null, email, metadata.ipAddress ?? null, metadata.userAgent ?? null],
    );
  }

  async recordSuccessfulLogin(userId: string, email: string, metadata: RequestMetadata): Promise<void> {
    await this.database.query(
      `update clinic.users set failed_login_count = 0, locked_until = null,
         last_login_at = now(), updated_at = now() where id = $1`,
      [userId],
    );
    await this.database.query(
      `insert into clinic.login_attempts (user_id, email, successful, ip_address, user_agent)
       values ($1, $2, true, $3, $4)`,
      [userId, email, metadata.ipAddress ?? null, metadata.userAgent ?? null],
    );
  }

  async createSession(session: SessionCreation): Promise<void> {
    await this.database.query(
      `insert into clinic.user_sessions
        (id, user_id, token_hash, expires_at, idle_expires_at, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [session.id, session.userId, session.tokenHash, session.expiresAt, session.idleExpiresAt,
        session.ipAddress ?? null, session.userAgent ?? null],
    );
  }

  async findPrincipalByTokenHash(tokenHash: string): Promise<SessionPrincipal | null> {
    const result = await this.database.query<SessionPrincipal>(
      `select s.id as session_id, u.id as user_id, u.email, u.full_name, u.title, u.room,
         u.must_change_password,
         coalesce(array_agg(distinct r.slug) filter (where r.slug is not null), '{}'::text[]) as roles,
         coalesce(array_agg(distinct p.slug) filter (where p.slug is not null), '{}'::text[]) as permissions
       from clinic.user_sessions s
       join clinic.users u on u.id = s.user_id
       left join clinic.user_roles ur on ur.user_id = u.id
       left join clinic.roles r on r.id = ur.role_id
       left join clinic.role_permissions rp on rp.role_id = r.id
       left join clinic.permissions p on p.id = rp.permission_id
       where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
         and s.idle_expires_at > now() and u.status = 'active'
         and (u.locked_until is null or u.locked_until <= now())
       group by s.id, u.id`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async touchSession(sessionId: string, idleMinutes: number): Promise<void> {
    await this.database.query(
      `update clinic.user_sessions set last_seen_at = now(),
         idle_expires_at = least(expires_at, now() + make_interval(mins => $2))
       where id = $1 and revoked_at is null`,
      [sessionId, idleMinutes],
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.database.query(
      "update clinic.user_sessions set revoked_at = coalesce(revoked_at, now()) where id = $1",
      [sessionId],
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.database.query(
      `update clinic.user_sessions set revoked_at = coalesce(revoked_at, now())
       where user_id = $1 and revoked_at is null`,
      [userId],
    );
  }

  async changePasswordAndRevokeSessions(userId: string, passwordHash: string): Promise<void> {
    await this.database.query(
      `with updated_user as (
         update clinic.users set password_hash = $2, must_change_password = false,
           password_changed_at = now(), failed_login_count = 0, locked_until = null, updated_at = now()
         where id = $1 returning id
       )
       update clinic.user_sessions set revoked_at = coalesce(revoked_at, now())
       where user_id in (select id from updated_user) and revoked_at is null`,
      [userId, passwordHash],
    );
  }
}
