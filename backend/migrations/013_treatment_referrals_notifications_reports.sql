create table clinic.treatment_courses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  procedure_name text not null,
  unit_price numeric(12,2) not null constraint treatment_courses_price_check check (unit_price >= 0),
  total_doses integer not null constraint treatment_courses_total_doses_check check (total_doses between 1 and 365),
  start_date date not null,
  billing_mode text not null constraint treatment_courses_billing_mode_check check (billing_mode in ('per_dose', 'package')),
  status text not null default 'active' constraint treatment_courses_status_check check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_by uuid not null references clinic.users(id) on delete restrict,
  completed_at timestamptz,
  cancelled_by uuid references clinic.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_courses_name_check check (btrim(procedure_name) <> ''),
  constraint treatment_courses_completion_check check ((status = 'completed') = (completed_at is not null)),
  constraint treatment_courses_cancellation_check check (
    (status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null and btrim(cancellation_reason) <> '')
  )
);

create index treatment_courses_patient_created_idx on clinic.treatment_courses (patient_id, created_at desc);
create index treatment_courses_catalog_item_id_idx on clinic.treatment_courses (catalog_item_id);
create index treatment_courses_created_by_idx on clinic.treatment_courses (created_by);
create index treatment_courses_cancelled_by_idx on clinic.treatment_courses (cancelled_by) where cancelled_by is not null;
create index treatment_courses_active_start_idx on clinic.treatment_courses (start_date, id) where status = 'active';

create table clinic.treatment_course_doses (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references clinic.treatment_courses(id) on delete cascade,
  dose_number integer not null constraint treatment_course_doses_number_check check (dose_number > 0),
  scheduled_date date not null,
  status text not null default 'scheduled' constraint treatment_course_doses_status_check
    check (status in ('scheduled', 'checked_in', 'given', 'missed', 'cancelled')),
  visit_id uuid unique references clinic.visits(id) on delete restrict,
  checked_in_by uuid references clinic.users(id) on delete restrict,
  checked_in_at timestamptz,
  given_by uuid references clinic.users(id) on delete restrict,
  given_at timestamptz,
  clinical_notes text,
  missed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, dose_number),
  constraint treatment_course_doses_checkin_check check (
    (status in ('checked_in', 'given') and visit_id is not null and checked_in_by is not null and checked_in_at is not null)
    or (status not in ('checked_in', 'given'))
  ),
  constraint treatment_course_doses_given_check check (
    (status = 'given') = (given_by is not null and given_at is not null)
  ),
  constraint treatment_course_doses_missed_check check (
    status <> 'missed' or btrim(missed_reason) <> ''
  )
);

create index treatment_course_doses_course_scheduled_idx on clinic.treatment_course_doses (course_id, scheduled_date, dose_number);
create index treatment_course_doses_checked_in_by_idx on clinic.treatment_course_doses (checked_in_by) where checked_in_by is not null;
create index treatment_course_doses_given_by_idx on clinic.treatment_course_doses (given_by) where given_by is not null;
create index treatment_course_doses_due_idx on clinic.treatment_course_doses (scheduled_date, id) where status in ('scheduled', 'checked_in');

create table clinic.procedure_administrations (
  id uuid primary key default gen_random_uuid(),
  treatment_course_dose_id uuid not null unique references clinic.treatment_course_doses(id) on delete restrict,
  visit_id uuid not null unique references clinic.visits(id) on delete restrict,
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  performed_by uuid not null references clinic.users(id) on delete restrict,
  notes text,
  performed_at timestamptz not null default now()
);

create index procedure_administrations_patient_performed_idx on clinic.procedure_administrations (patient_id, performed_at desc);
create index procedure_administrations_catalog_item_id_idx on clinic.procedure_administrations (catalog_item_id);
create index procedure_administrations_performed_by_idx on clinic.procedure_administrations (performed_by);

create table clinic.referrals (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references clinic.visits(id) on delete restrict,
  encounter_id uuid references clinic.encounters(id) on delete restrict,
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  from_clinician_id uuid not null references clinic.users(id) on delete restrict,
  recipient_user_id uuid references clinic.users(id) on delete restrict,
  destination_type text not null constraint referrals_destination_type_check check (destination_type in ('department', 'branch', 'external')),
  to_department text,
  to_branch text,
  external_provider text,
  diagnosis text not null,
  notes text not null,
  status text not null default 'created' constraint referrals_status_check check (status in ('created', 'sent', 'accepted', 'completed', 'cancelled')),
  sent_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrals_text_check check (btrim(diagnosis) <> '' and btrim(notes) <> ''),
  constraint referrals_destination_check check (
    (destination_type = 'department' and btrim(to_department) <> '' and to_branch is null and external_provider is null)
    or (destination_type = 'branch' and btrim(to_branch) <> '' and to_department is null and external_provider is null)
    or (destination_type = 'external' and btrim(external_provider) <> '' and to_department is null and to_branch is null)
  ),
  constraint referrals_cancellation_check check (status <> 'cancelled' or (cancelled_at is not null and btrim(cancellation_reason) <> ''))
);

create index referrals_visit_id_idx on clinic.referrals (visit_id);
create index referrals_encounter_id_idx on clinic.referrals (encounter_id) where encounter_id is not null;
create index referrals_patient_created_idx on clinic.referrals (patient_id, created_at desc);
create index referrals_from_clinician_idx on clinic.referrals (from_clinician_id, created_at desc);
create index referrals_recipient_open_idx on clinic.referrals (recipient_user_id, created_at desc)
  where recipient_user_id is not null and status not in ('completed', 'cancelled');
create index referrals_open_status_idx on clinic.referrals (status, created_at) where status not in ('completed', 'cancelled');

create table clinic.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references clinic.users(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  resource_type text,
  resource_id uuid,
  available_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_text_check check (btrim(kind) <> '' and btrim(title) <> '' and btrim(message) <> '')
);

create index notifications_recipient_created_idx on clinic.notifications (recipient_user_id, created_at desc, id);
create index notifications_unread_available_idx on clinic.notifications (recipient_user_id, available_at, created_at desc)
  where read_at is null;

insert into clinic.permissions (slug, description)
values
  ('course.read', 'View treatment courses and scheduled procedure doses'),
  ('course.manage', 'Create, reschedule, miss, and cancel treatment courses'),
  ('referral.read', 'View clinical referrals'),
  ('referral.create', 'Create clinical referrals'),
  ('referral.manage', 'Advance or cancel clinical referrals')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r join clinic.permissions p on p.slug = any(array[
  'course.read', 'course.manage', 'referral.read'
]) where r.slug = 'receptionist' on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r join clinic.permissions p on p.slug = any(array[
  'course.read', 'course.manage', 'referral.read', 'referral.create', 'referral.manage'
]) where r.slug = 'doctor' on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r join clinic.permissions p on p.slug = any(array[
  'course.read', 'referral.read'
]) where r.slug = 'nurse' on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r cross join clinic.permissions p
where r.slug = 'admin' on conflict do nothing;
