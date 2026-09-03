# Phase 2: Core patient journey

This phase turns the Phase 1 identity foundation into the clinic's operational workflow. Supabase remains the hosted PostgreSQL provider only; every request goes through the Express API and its local session/RBAC layer.

## Workflow

```text
Patient registration
       │
       ├── optional future appointment
       │
       ▼
Check-in → triage queue → triage observations → doctor queue
                                                │
                                                ▼
                                      open encounter
                                                │
                                                ▼
                                      document and sign
                                                │
                                                ▼
                                      ready for billing
```

Only one active visit and one active queue entry are allowed for a patient/visit. Queue transitions create immutable history rows. Signing an encounter makes its clinical fields immutable; later corrections are append-only amendments with author, reason, content, and timestamp.

## Endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/patients` | `patient.read` | Search patients using cursor pagination |
| GET | `/api/v1/patients/:patientId` | `patient.read` | Patient demographics and allergies |
| POST | `/api/v1/patients` | `patient.create` | Register a patient and generate an MRN |
| PUT | `/api/v1/patients/:patientId` | `patient.update` | Update demographics and allergy list |
| GET | `/api/v1/appointments` | `appointment.manage` | List appointments in a bounded date range |
| POST | `/api/v1/appointments` | `appointment.manage` | Schedule an appointment |
| POST | `/api/v1/appointments/:id/cancel` | `appointment.manage` | Cancel a scheduled appointment |
| POST | `/api/v1/visits/check-in` | `visit.manage` | Check in a patient and join triage queue |
| GET | `/api/v1/visits/:visitId` | `patient.read` | Visit and current queue state |
| PUT | `/api/v1/visits/:visitId/triage` | `triage.record` | Record vitals and transfer to doctor queue |
| GET | `/api/v1/queue?station=doctor` | `queue.read` | Live station board ordered by priority/wait |
| PATCH | `/api/v1/queue/:queueEntryId` | `queue.manage` | Call, start, or cancel a queue entry |
| POST | `/api/v1/encounters` | `encounter.start` | Start the visit consultation |
| GET | `/api/v1/encounters/by-visit/:visitId` | `encounter.read` | Load the encounter and amendments |
| PATCH | `/api/v1/encounters/:encounterId` | `encounter.document` | Save open clinical documentation |
| POST | `/api/v1/encounters/:encounterId/sign` | `encounter.sign` | Sign and make the record immutable |
| POST | `/api/v1/encounters/:encounterId/amendments` | `encounter.sign` | Append a correction to a signed encounter |

## Database design notes

- All clinical tables live in the private `clinic` schema, not Supabase's exposed `public` schema.
- Foreign-key columns used for joins or deletion checks are indexed.
- Active-work indexes are partial, keeping completed historical rows out of hot queue indexes.
- Date/time values use `timestamptz`; measurements use bounded exact numeric or integer types.
- Queue, triage, check-in, encounter start, signing, and audit writes use short PostgreSQL transactions.
- Patient lists use `(created_at, id)` keyset pagination instead of deep offsets.

Apply migrations with `npm run migrate` after configuring `DATABASE_URL`. Migrations `003` through `006` implement this phase.
