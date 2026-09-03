import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { env } from "../config/env";

const migrationPool = new Pool({
  connectionString: env.DIRECT_URL ?? env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

async function migrate(): Promise<void> {
  const migrationsDirectory = path.resolve(__dirname, "../../migrations");
  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  const client = await migrationPool.connect();
  try {
    await client.query("create schema if not exists clinic");
    await client.query(`
      create table if not exists clinic.schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    for (const filename of filenames) {
      const sql = await fs.readFile(path.join(migrationsDirectory, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "select checksum from clinic.schema_migrations where filename = $1",
        [filename],
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${filename} has been modified`);
        }
        continue;
      }

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into clinic.schema_migrations (filename, checksum) values ($1, $2)",
          [filename, checksum],
        );
        await client.query("commit");
        console.info(`Applied migration ${filename}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
    await migrationPool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
