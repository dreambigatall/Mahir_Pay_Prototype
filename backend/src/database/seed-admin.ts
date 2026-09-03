import { Pool } from "pg";

import { env } from "../config/env";
import { hashPassword } from "../shared/security/password";
import { passwordSchema } from "../shared/validation/password-policy";
import { withTransaction } from "./transaction";

const administrativePool = new Pool({
  connectionString: env.DIRECT_URL ?? env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

async function seedAdmin(): Promise<void> {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const fullName = process.env.INITIAL_ADMIN_NAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !fullName || !password) {
    throw new Error("INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_NAME, and INITIAL_ADMIN_PASSWORD are required");
  }
  passwordSchema.parse(password);
  const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER);

  const result = await withTransaction(administrativePool, async (client) => {
    const user = await client.query<{ id: string }>(
      `insert into clinic.users (email, password_hash, full_name, must_change_password)
       values ($1, $2, $3, true)
       on conflict (lower(email)) do nothing
       returning id`,
      [email, passwordHash, fullName],
    );
    if (!user.rows[0]) {
      throw new Error("An account with INITIAL_ADMIN_EMAIL already exists; no changes were made");
    }
    await client.query(
      `insert into clinic.user_roles (user_id, role_id)
       select $1, id from clinic.roles where slug = 'admin'`,
      [user.rows[0].id],
    );
    return user.rows[0].id;
  });
  console.log(`Created initial administrator ${result}`);
}

seedAdmin()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => administrativePool.end());
