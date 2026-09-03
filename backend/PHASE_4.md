# Phase 4 — Extended Care Workflows and Frontend API Foundation

Phase 4 adds the first expandable care workflows beyond a single consultation and replaces prototype-only authentication with the backend's local session system.

## Hosting boundary

Supabase is used only as the hosted PostgreSQL provider. The application connects through `DATABASE_URL` using `pg` from the Express server.

- No Supabase Auth
- No `supabase-js` or browser database client
- No Supabase Storage, Realtime, Edge Functions, or Data API
- No Supabase public/secret keys in the frontend

All identity, authorization, validation, audit, and workflow rules remain in this application.

## Database migrations

- `013_treatment_referrals_notifications_reports.sql`
  - treatment courses and daily doses
  - immutable procedure-administration records
  - referrals and lifecycle timestamps
  - user-owned in-app notifications
  - Phase 4 permissions and role assignments
- `014_phase_four_integrity_guards.sql`
  - strict lifecycle and nullable-field consistency checks
  - exact destination rules for referrals

Every new foreign key used for joins has an index. Due/open worklists use partial or composite indexes.

## API modules

### Treatment courses

- `GET /api/v1/treatment-courses`
- `GET /api/v1/treatment-courses/:id`
- `POST /api/v1/treatment-courses`
- `POST /api/v1/treatment-courses/:id/doses/:doseId/check-in`
- `POST /api/v1/treatment-courses/:id/doses/:doseId/administer`
- `POST /api/v1/treatment-courses/:id/doses/:doseId/miss`
- `POST /api/v1/treatment-courses/:id/cancel`

Check-in creates a procedure visit and procedure queue entry in one short transaction. Administration creates a permanent clinical administration record, completes the queue entry, and moves the visit to billing.

### Referrals

- `GET /api/v1/referrals`
- `GET /api/v1/referrals/:id`
- `POST /api/v1/referrals`
- `PATCH /api/v1/referrals/:id/status`

Allowed transitions are `created → sent → accepted → completed`; cancellation is allowed before completion. Transitions are checked again after locking the database row.

### Notifications

- `GET /api/v1/notifications?unreadOnly=true`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

Notifications are scoped to the authenticated user. Treatment-dose reminders can be scheduled with `available_at`, and assigned staff receive referral notifications.

### Reports

- `GET /api/v1/reports/dashboard`
- `GET /api/v1/reports/period?from=<ISO>&to=<ISO>`

Reports expose aggregate operational and financial data only and require `reports.read`. Date ranges are limited to one year.

## Frontend integration

`frontend/src/lib/api` now contains the shared credentialed API client and feature clients for authentication, treatment courses, referrals, notifications, and reports.

The login screen now calls `/api/v1/auth/login`; session hydration calls `/api/v1/auth/me`; sign-out revokes the server session before redirecting. The session token stays in an HTTP-only cookie and is never stored in `localStorage`.

Set the frontend API origin with:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

The remaining prototype screens still use the local clinic store. They can now be migrated feature by feature onto the Phase 2–4 API clients without changing authentication again.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set the Supabase PostgreSQL pooler connection string as `DATABASE_URL`.
2. Set a strong `PASSWORD_PEPPER`.
3. Run `npm run migrate` in `backend`.
4. Run `npm run seed:admin` once.
5. Copy `frontend/.env.example` to `frontend/.env.local`.
6. Start the backend and frontend with `npm run dev` in their folders.

## Verification

- Backend TypeScript production build
- Backend test suite, including Phase 4 schema and transition guards
- Frontend TypeScript check and production Next.js build
- ESLint audit completed; existing prototype lint debt remains outside the Phase 4 API contracts

Live migration verification still requires a configured `DATABASE_URL`.

## Recommended Phase 5

Replace local prototype state one vertical at a time: patients and queues first, then diagnostics/pharmacy/billing, then courses/referrals/reports. Add API-level integration tests against a disposable PostgreSQL database during that migration.
