create sequence clinic.patient_mrn_seq start with 1000;
create sequence clinic.visit_number_seq start with 1000;

create table clinic.patients (
  id uuid primary key default gen_random_uuid(),
  medical_record_number text not null unique
    default ('PAT-' || lpad(nextval('clinic.patient_mrn_seq')::text, 6, '0')),
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date not null,
  sex text not null constraint patients_sex_check check (sex in ('female', 'male', 'intersex', 'unknown')),
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  blood_group text constraint patients_blood_group_check
    check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  active boolean not null default true,
  created_by uuid not null references clinic.users(id) on delete restrict,
  updated_by uuid not null references clinic.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_name_not_blank_check
    check (btrim(first_name) <> '' and btrim(last_name) <> ''),
  constraint patients_date_of_birth_check check (date_of_birth <= current_date)
);

alter sequence clinic.patient_mrn_seq owned by clinic.patients.medical_record_number;
create index patients_name_search_idx on clinic.patients (lower(last_name), lower(first_name), id);
create index patients_phone_idx on clinic.patients (phone) where phone is not null;
create index patients_created_by_idx on clinic.patients (created_by);
create index patients_updated_by_idx on clinic.patients (updated_by);

create table clinic.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references clinic.patients(id) on delete cascade,
  allergen text not null,
  reaction text,
  severity text constraint patient_allergies_severity_check
    check (severity is null or severity in ('mild', 'moderate', 'severe')),
  recorded_by uuid not null references clinic.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint patient_allergies_allergen_not_blank_check check (btrim(allergen) <> '')
);

create unique index patient_allergies_patient_allergen_uidx
  on clinic.patient_allergies (patient_id, lower(allergen));
create index patient_allergies_recorded_by_idx on clinic.patient_allergies (recorded_by);

create table clinic.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  doctor_id uuid references clinic.users(id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30
    constraint appointments_duration_check check (duration_minutes between 5 and 480),
  reason text not null,
  status text not null default 'scheduled'
    constraint appointments_status_check
      check (status in ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid not null references clinic.users(id) on delete restrict,
  cancelled_by uuid references clinic.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_reason_not_blank_check check (btrim(reason) <> ''),
  constraint appointments_cancellation_check check (
    (status <> 'cancelled' and cancelled_at is null and cancelled_by is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
  )
);

create index appointments_patient_scheduled_idx on clinic.appointments (patient_id, scheduled_at desc);
create index appointments_doctor_scheduled_idx on clinic.appointments (doctor_id, scheduled_at)
  where status in ('scheduled', 'confirmed');
create index appointments_created_by_idx on clinic.appointments (created_by);
create index appointments_cancelled_by_idx on clinic.appointments (cancelled_by) where cancelled_by is not null;

create table clinic.visits (
  id uuid primary key default gen_random_uuid(),
  visit_number text not null unique
    default ('VIS-' || lpad(nextval('clinic.visit_number_seq')::text, 6, '0')),
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  appointment_id uuid unique references clinic.appointments(id) on delete restrict,
  doctor_id uuid references clinic.users(id) on delete restrict,
  receptionist_id uuid not null references clinic.users(id) on delete restrict,
  kind text not null default 'consultation'
    constraint visits_kind_check check (kind in ('consultation', 'procedure')),
  reason text not null,
  status text not null default 'registered'
    constraint visits_status_check check (status in (
      'registered', 'awaiting_triage', 'awaiting_doctor', 'in_consultation',
      'awaiting_lab', 'lab_complete', 'medication_prescribed',
      'ready_for_billing', 'billed', 'completed', 'cancelled'
    )),
  priority text not null default 'routine'
    constraint visits_priority_check check (priority in ('routine', 'urgent', 'emergency')),
  checked_in_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visits_reason_not_blank_check check (btrim(reason) <> ''),
  constraint visits_completion_check check ((status in ('completed', 'billed')) = (completed_at is not null)),
  constraint visits_cancellation_check check ((status = 'cancelled') = (cancelled_at is not null))
);

alter sequence clinic.visit_number_seq owned by clinic.visits.visit_number;
create index visits_patient_checked_in_idx on clinic.visits (patient_id, checked_in_at desc);
create index visits_doctor_active_idx on clinic.visits (doctor_id, checked_in_at)
  where status not in ('completed', 'billed', 'cancelled');
create index visits_receptionist_id_idx on clinic.visits (receptionist_id);
create index visits_active_status_checked_idx on clinic.visits (status, checked_in_at)
  where status not in ('completed', 'billed', 'cancelled');

create table clinic.queue_entries (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references clinic.visits(id) on delete cascade,
  station text not null
    constraint queue_entries_station_check check (station in ('triage', 'doctor', 'lab', 'pharmacy', 'billing', 'procedure')),
  status text not null default 'waiting'
    constraint queue_entries_status_check check (status in ('waiting', 'called', 'in_service', 'completed', 'cancelled')),
  priority text not null default 'routine'
    constraint queue_entries_priority_check check (priority in ('routine', 'urgent', 'emergency')),
  assigned_user_id uuid references clinic.users(id) on delete restrict,
  queued_at timestamptz not null default now(),
  called_at timestamptz,
  service_started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index queue_entries_one_active_per_visit_uidx on clinic.queue_entries (visit_id)
  where status in ('waiting', 'called', 'in_service');
create index queue_entries_board_idx on clinic.queue_entries (station, priority desc, queued_at, id)
  where status in ('waiting', 'called', 'in_service');
create index queue_entries_assigned_active_idx on clinic.queue_entries (assigned_user_id, queued_at)
  where status in ('waiting', 'called', 'in_service') and assigned_user_id is not null;

create table clinic.queue_events (
  id bigint generated always as identity primary key,
  queue_entry_id uuid not null references clinic.queue_entries(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid not null references clinic.users(id) on delete restrict,
  notes text,
  occurred_at timestamptz not null default now()
);

create index queue_events_entry_occurred_idx on clinic.queue_events (queue_entry_id, occurred_at);
create index queue_events_actor_user_id_idx on clinic.queue_events (actor_user_id);

create table clinic.triage_observations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references clinic.visits(id) on delete cascade,
  recorded_by uuid not null references clinic.users(id) on delete restrict,
  temperature_c numeric(4,1) constraint triage_temperature_check
    check (temperature_c is null or temperature_c between 25 and 45),
  systolic_bp smallint constraint triage_systolic_check
    check (systolic_bp is null or systolic_bp between 40 and 300),
  diastolic_bp smallint constraint triage_diastolic_check
    check (diastolic_bp is null or diastolic_bp between 20 and 200),
  pulse_bpm smallint constraint triage_pulse_check
    check (pulse_bpm is null or pulse_bpm between 20 and 300),
  respiratory_rate smallint constraint triage_respiratory_check
    check (respiratory_rate is null or respiratory_rate between 5 and 100),
  oxygen_saturation numeric(5,2) constraint triage_oxygen_check
    check (oxygen_saturation is null or oxygen_saturation between 40 and 100),
  weight_kg numeric(6,2) constraint triage_weight_check
    check (weight_kg is null or weight_kg > 0),
  height_cm numeric(5,1) constraint triage_height_check
    check (height_cm is null or height_cm > 0),
  pain_score smallint constraint triage_pain_check
    check (pain_score is null or pain_score between 0 and 10),
  notes text,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index triage_observations_recorded_by_idx on clinic.triage_observations (recorded_by);

create table clinic.encounters (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references clinic.visits(id) on delete restrict,
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  clinician_id uuid not null references clinic.users(id) on delete restrict,
  status text not null default 'open'
    constraint encounters_status_check check (status in ('open', 'signed')),
  subjective text,
  objective text,
  assessment text,
  plan text,
  diagnosis text,
  started_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_by uuid references clinic.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint encounters_signature_check
    check ((status = 'signed') = (signed_at is not null and signed_by is not null))
);

create index encounters_patient_started_idx on clinic.encounters (patient_id, started_at desc);
create index encounters_clinician_started_idx on clinic.encounters (clinician_id, started_at desc);
create index encounters_signed_by_idx on clinic.encounters (signed_by) where signed_by is not null;

create table clinic.encounter_amendments (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references clinic.encounters(id) on delete restrict,
  author_user_id uuid not null references clinic.users(id) on delete restrict,
  reason text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint encounter_amendments_reason_check check (btrim(reason) <> ''),
  constraint encounter_amendments_content_check check (btrim(content) <> '')
);

create index encounter_amendments_encounter_created_idx
  on clinic.encounter_amendments (encounter_id, created_at);
create index encounter_amendments_author_user_id_idx on clinic.encounter_amendments (author_user_id);

insert into clinic.permissions (slug, description)
values
  ('appointment.manage', 'Schedule, update, cancel, and check in appointments'),
  ('visit.manage', 'Create, cancel, and manage visits'),
  ('triage.record', 'Record and update triage observations')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any (array[
  'appointment.manage', 'visit.manage'
])
where r.slug = 'receptionist'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any (array[
  'visit.manage', 'triage.record'
])
where r.slug = 'nurse'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = 'visit.manage'
where r.slug = 'doctor'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
cross join clinic.permissions p
where r.slug = 'admin'
on conflict do nothing;
