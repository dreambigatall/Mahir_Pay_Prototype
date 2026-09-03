# Mahir Clinic API

Phase 1 backend foundation for the clinic prototype. It uses Node.js, Express, TypeScript, and PostgreSQL. Supabase supplies only the hosted PostgreSQL connection; the API does not use Supabase Auth, client SDKs, Storage, Realtime, or Edge Functions.

## Included in this phase

- Password authentication with Argon2id and an application pepper
- Opaque session cookies; only SHA-256 token hashes are stored in PostgreSQL
- Absolute and idle session expiry, logout, password change, and session revocation
- Role-based permissions for administrator, receptionist, doctor, lab, and nurse workflows
- Staff listing, creation, role discovery, enable/disable, and audit history
- Login throttling, account lockout, secure headers, CORS/origin checks, request IDs, and health probes
- Ordered, checksum-protected SQL migrations

## Configure

1. Create a Supabase project and copy its PostgreSQL connection string. Prefer the Supavisor transaction-pooler URI for a horizontally scaled API, or the direct URI when the host supports IPv6 and persistent connections.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to the hosted PostgreSQL URI. Keep `DATABASE_SSL=true` for Supabase.
4. Generate a random `PASSWORD_PEPPER` of at least 32 characters and store it in the backend secret manager, not in PostgreSQL.

The connection must be a PostgreSQL URI. No Supabase URL, anon key, service-role key, or JWT secret is used by this backend.

## Run

```powershell
npm install
npm run migrate
$env:INITIAL_ADMIN_EMAIL = "admin@yourclinic.com"
$env:INITIAL_ADMIN_NAME = "Clinic Administrator"
$env:INITIAL_ADMIN_PASSWORD = "replace-with-a-strong-temporary-password"
npm run seed:admin
npm run dev
```

Run these commands from the `backend` directory. The administrator is required to change the seeded temporary password after first login.

## Initial API

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health/live` | Public | Process liveness |
| GET | `/health/ready` | Public | PostgreSQL readiness |
| POST | `/api/v1/auth/login` | Public | Create a local API session |
| GET | `/api/v1/auth/me` | Signed in | Return current identity and permissions |
| POST | `/api/v1/auth/logout` | Signed in | Revoke the current session |
| POST | `/api/v1/auth/change-password` | Signed in | Change password and revoke every session |
| GET | `/api/v1/staff` | `staff.manage` | Paginated staff directory |
| POST | `/api/v1/staff` | `staff.manage` | Create staff with roles and temporary password |
| PATCH | `/api/v1/staff/:userId/status` | `staff.manage` | Enable/disable a staff account |
| GET | `/api/v1/staff/roles` | `roles.read` | List assignable roles |

The browser must send cookies (`credentials: "include"`). Mutating requests must come from `FRONTEND_ORIGIN`.

## Next implementation slice

Build the operational patient journey on this base: patients and identifiers, visits and appointments, check-in/queue, triage, encounter lifecycle, and immutable encounter audit events. Billing and diagnostics should follow once the encounter lifecycle is stable.
