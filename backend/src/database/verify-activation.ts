import { Pool } from "pg";

import { env } from "../config/env";

const options = {
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
};
const runtimePool = new Pool({ ...options, connectionString: env.DATABASE_URL });
const administrativePool = new Pool({
  ...options,
  connectionString: env.DIRECT_URL ?? env.DATABASE_URL,
});

async function verifyActivation(): Promise<void> {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error("INITIAL_ADMIN_EMAIL is required");

  const runtime = await runtimePool.query<{ connected: number }>("select 1 as connected");
  const migrations = await administrativePool.query<{
    migration_count: number;
    latest_migration: string;
  }>(`select count(*)::integer as migration_count, max(filename) as latest_migration
      from clinic.schema_migrations`);
  const tables = await administrativePool.query<{
    users: string | null;
    treatment_courses: string | null;
    referrals: string | null;
    notifications: string | null;
  }>(`select
        to_regclass('clinic.users')::text as users,
        to_regclass('clinic.treatment_courses')::text as treatment_courses,
        to_regclass('clinic.referrals')::text as referrals,
        to_regclass('clinic.notifications')::text as notifications`);
  const admin = await administrativePool.query<{
    account_exists: boolean;
    admin_role_assigned: boolean;
    must_change_password: boolean;
  }>(
    `select
       exists(select 1 from clinic.users where lower(email) = lower($1) and status = 'active') as account_exists,
       exists(
         select 1 from clinic.users u
         join clinic.user_roles ur on ur.user_id = u.id
         join clinic.roles r on r.id = ur.role_id
         where lower(u.email) = lower($1) and r.slug = 'admin'
       ) as admin_role_assigned,
       coalesce((select must_change_password from clinic.users where lower(email) = lower($1)), false) as must_change_password`,
    [adminEmail],
  );

  const result = {
    runtimePoolConnected: runtime.rows[0]?.connected === 1,
    migrationCount: migrations.rows[0]?.migration_count,
    latestMigration: migrations.rows[0]?.latest_migration,
    requiredTablesPresent: Object.values(tables.rows[0] ?? {}).every(Boolean),
    adminAccountExists: admin.rows[0]?.account_exists,
    adminRoleAssigned: admin.rows[0]?.admin_role_assigned,
    adminMustChangePassword: admin.rows[0]?.must_change_password,
  };
  if (
    !result.runtimePoolConnected ||
    result.migrationCount !== 14 ||
    !result.requiredTablesPresent ||
    !result.adminAccountExists ||
    !result.adminRoleAssigned ||
    !result.adminMustChangePassword
  ) {
    throw new Error(`Activation verification failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

verifyActivation()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([runtimePool.end(), administrativePool.end()]);
  });
