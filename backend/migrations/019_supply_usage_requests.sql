-- Lab logs today's clinic-supply usage; admin approves before stock is deducted.

insert into clinic.permissions (slug, description)
values
  ('inventory.request', 'Submit clinic supply usage requests for admin approval'),
  ('inventory.approve', 'Approve or reject clinic supply usage requests')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = 'inventory.approve'
where r.slug = 'admin'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any(array['inventory.read', 'inventory.request'])
where r.slug = 'lab'
on conflict do nothing;

-- Lab no longer deducts stock directly; usage goes through approval.
delete from clinic.role_permissions rp
using clinic.roles r, clinic.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.slug = 'lab'
  and p.slug in ('inventory.issue', 'inventory.count');

create table if not exists clinic.supply_usage_requests (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  location_id uuid not null references clinic.inventory_locations(id) on delete restrict,
  quantity numeric(14,3) not null
    constraint supply_usage_requests_quantity_check check (quantity > 0),
  reason text not null
    constraint supply_usage_requests_reason_not_blank check (btrim(reason) <> ''),
  status text not null default 'pending'
    constraint supply_usage_requests_status_check
      check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references clinic.users(id) on delete restrict,
  reviewed_by uuid references clinic.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  movement_id bigint references clinic.inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_usage_requests_review_consistency check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and movement_id is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and movement_id is not null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and movement_id is null)
  )
);

create index if not exists supply_usage_requests_status_created_idx
  on clinic.supply_usage_requests (status, created_at desc);

create index if not exists supply_usage_requests_requested_by_idx
  on clinic.supply_usage_requests (requested_by, created_at desc);

create index if not exists supply_usage_requests_item_idx
  on clinic.supply_usage_requests (catalog_item_id, created_at desc);
