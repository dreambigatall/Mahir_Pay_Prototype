import { Pool } from "pg";

import { env } from "../config/env";
import { hashPassword } from "../shared/security/password";
import { passwordSchema } from "../shared/validation/password-policy";

const pool = new Pool({ connectionString: env.DIRECT_URL ?? env.DATABASE_URL, max: 1, ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false });

async function reset() {
  const email=process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.INITIAL_ADMIN_PASSWORD;
  if(!email||!password)throw new Error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required");
  passwordSchema.parse(password);const passwordHash=await hashPassword(password,env.PASSWORD_PEPPER);
  const result=await pool.query(`update clinic.users u set password_hash=$2,status='active',must_change_password=true,failed_login_count=0,locked_until=null,updated_at=now() where lower(u.email)=lower($1) and exists(select 1 from clinic.user_roles ur join clinic.roles r on r.id=ur.role_id where ur.user_id=u.id and r.slug='admin') returning u.id`,[email,passwordHash]);
  if(!result.rowCount)throw new Error("Configured administrator account was not found");
  await pool.query(`update clinic.user_sessions set revoked_at=coalesce(revoked_at,now()) where user_id=$1 and revoked_at is null`,[result.rows[0].id]);
  console.info("Administrator password reset; existing sessions revoked");
  await pool.end();
}

reset().catch(async error=>{console.error(error instanceof Error?error.message:error);await pool.end();process.exitCode=1;});
