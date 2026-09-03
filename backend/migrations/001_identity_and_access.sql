create schema if not exists clinic;
revoke all on schema clinic from public;

create table clinic.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  title text,
  room text,
  status text not null default 'active'
    constraint users_status_check check (status in ('active', 'disabled', 'locked')),
  must_change_password boolean not null default true,
  failed_login_count integer not null default 0
    constraint users_failed_login_count_check check (failed_login_count >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_lower_uidx on clinic.users (lower(email));
create index users_active_name_idx on clinic.users (lower(full_name)) where status = 'active';

create table clinic.roles (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table clinic.permissions (
  id bigint generated always as identity primary key,
  slug text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table clinic.user_roles (
  user_id uuid not null references clinic.users(id) on delete cascade,
  role_id bigint not null references clinic.roles(id) on delete restrict,
  assigned_by uuid references clinic.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_role_id_idx on clinic.user_roles (role_id);
create index user_roles_assigned_by_idx on clinic.user_roles (assigned_by);

create table clinic.role_permissions (
  role_id bigint not null references clinic.roles(id) on delete cascade,
  permission_id bigint not null references clinic.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create index role_permissions_permission_id_idx
  on clinic.role_permissions (permission_id);

create table clinic.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references clinic.users(id) on delete cascade,
  token_hash text not null unique
    constraint user_sessions_token_hash_length_check check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  idle_expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint user_sessions_expiry_check check (expires_at > created_at)
);

create index user_sessions_user_id_idx on clinic.user_sessions (user_id);
create index user_sessions_active_token_idx
  on clinic.user_sessions (token_hash, expires_at, idle_expires_at)
  where revoked_at is null;

create table clinic.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references clinic.users(id) on delete cascade,
  token_hash text not null unique
    constraint password_reset_tokens_hash_length_check check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_tokens_expiry_check check (expires_at > created_at)
);

create index password_reset_tokens_user_id_idx
  on clinic.password_reset_tokens (user_id);

create table clinic.login_attempts (
  id bigint generated always as identity primary key,
  user_id uuid references clinic.users(id) on delete set null,
  email text not null,
  successful boolean not null,
  failure_reason text,
  ip_address inet,
  user_agent text,
  attempted_at timestamptz not null default now()
);

create index login_attempts_user_id_attempted_idx
  on clinic.login_attempts (user_id, attempted_at desc);
create index login_attempts_email_attempted_idx
  on clinic.login_attempts (lower(email), attempted_at desc);

create table clinic.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references clinic.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_events_actor_created_idx
  on clinic.audit_events (actor_user_id, created_at desc);
create index audit_events_resource_created_idx
  on clinic.audit_events (resource_type, resource_id, created_at desc);
create index audit_events_request_id_idx on clinic.audit_events (request_id);
