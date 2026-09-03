import { Pool } from "pg";

import { env } from "../config/env";

export const databasePool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

databasePool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
