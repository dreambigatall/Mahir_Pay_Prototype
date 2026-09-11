-- Pilot inventory controls: locations, traceable stock, counts, idempotency, and least-privilege permissions.

insert into clinic.permissions (slug, description)
values
  ('inventory.read', 'View inventory balances, batches, locations, and movements'),
  ('inventory.receive', 'Receive inventory deliveries'),
  ('inventory.issue', 'Issue or consume clinic inventory'),
  ('inventory.count', 'Record physical inventory counts'),
  ('inventory.transfer', 'Transfer inventory between clinic locations'),
  ('inventory.adjust', 'Record exceptional inventory adjustments and write-offs'),
  ('inventory.configure', 'Configure inventory items, categories, locations, and reorder levels')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any(array[
  'inventory.read','inventory.receive','inventory.issue','inventory.count',
  'inventory.transfer','inventory.adjust','inventory.configure'
])
where r.slug = 'admin'
on conflict do nothing;

-- The former broad permission is no longer used by inventory routes.
delete from clinic.role_permissions rp
using clinic.roles r, clinic.permissions p
where rp.role_id = r.id and rp.permission_id = p.id
  and p.slug = 'inventory.manage' and r.slug <> 'admin';

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any(array[
  'inventory.read','inventory.receive','inventory.issue','inventory.count','inventory.transfer'
])
where r.slug = 'pharmacist'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any(array['inventory.read','inventory.issue','inventory.count'])
where r.slug in ('lab','nurse')
on conflict do nothing;

create table clinic.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint inventory_locations_code_not_blank check (btrim(code) <> ''),
  constraint inventory_locations_name_not_blank check (btrim(name) <> '')
);

insert into clinic.inventory_locations (code, name)
values
  ('main_store', 'Main store'),
  ('pharmacy', 'Pharmacy'),
  ('laboratory', 'Laboratory'),
  ('treatment_room', 'Treatment room')
on conflict (code) do update set name = excluded.name;

alter table clinic.inventory_batches
  add column if not exists pack_quantity numeric(14,3),
  add column if not exists units_per_pack numeric(14,3) not null default 1;

alter table clinic.inventory_batches
  add constraint inventory_batches_pack_quantity_check
    check (pack_quantity is null or pack_quantity > 0),
  add constraint inventory_batches_units_per_pack_check
    check (units_per_pack > 0);

create table clinic.inventory_batch_stocks (
  inventory_batch_id uuid not null references clinic.inventory_batches(id) on delete restrict,
  location_id uuid not null references clinic.inventory_locations(id) on delete restrict,
  quantity numeric(14,3) not null constraint inventory_batch_stocks_quantity_check check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (inventory_batch_id, location_id)
);

create index inventory_batch_stocks_location_idx
  on clinic.inventory_batch_stocks (location_id, inventory_batch_id)
  where quantity > 0;

-- Existing medicine stock is considered pharmacy stock; clinic supplies start in the main store.
insert into clinic.inventory_batch_stocks (inventory_batch_id, location_id, quantity)
select b.id,
  case when c.item_type = 'drug'
    then (select id from clinic.inventory_locations where code = 'pharmacy')
    else (select id from clinic.inventory_locations where code = 'main_store')
  end,
  b.quantity_remaining
from clinic.inventory_batches b
join clinic.catalog_items c on c.id = b.catalog_item_id
on conflict do nothing;

-- Convert legacy/opening balances that have no batch into an explicit non-expiring opening batch.
with gaps as (
  select c.id catalog_item_id, c.item_type,
    greatest(0, ib.quantity_on_hand - coalesce(sum(b.quantity_remaining), 0)) quantity
  from clinic.catalog_items c
  join clinic.inventory_balances ib on ib.catalog_item_id = c.id
  left join clinic.inventory_batches b on b.catalog_item_id = c.id
  where c.track_inventory
  group by c.id, c.item_type, ib.quantity_on_hand
), inserted as (
  insert into clinic.inventory_batches (
    catalog_item_id,batch_number,supplier_name,purchase_reference,
    received_quantity,quantity_remaining,received_by
  )
  select g.catalog_item_id,'OPENING-STOCK','Opening balance','Migration 018',g.quantity,g.quantity,c.created_by
  from gaps g
  join clinic.catalog_items c on c.id = g.catalog_item_id
  where g.quantity > 0
  on conflict (catalog_item_id,batch_number) do nothing
  returning id,catalog_item_id,quantity_remaining
)
insert into clinic.inventory_batch_stocks (inventory_batch_id,location_id,quantity)
select i.id,
  case when c.item_type = 'drug'
    then (select id from clinic.inventory_locations where code = 'pharmacy')
    else (select id from clinic.inventory_locations where code = 'main_store')
  end,
  i.quantity_remaining
from inserted i
join clinic.catalog_items c on c.id = i.catalog_item_id
on conflict do nothing;

alter table clinic.inventory_movements
  add column if not exists source_location_id uuid references clinic.inventory_locations(id) on delete restrict,
  add column if not exists destination_location_id uuid references clinic.inventory_locations(id) on delete restrict,
  add column if not exists transaction_reference text,
  add column if not exists movement_quantity numeric(14,3);

update clinic.inventory_movements
set movement_quantity = abs(quantity_delta)
where movement_quantity is null;

alter table clinic.inventory_movements
  alter column movement_quantity set not null,
  add constraint inventory_movements_movement_quantity_check check (movement_quantity > 0);

alter table clinic.inventory_movements drop constraint if exists inventory_movements_quantity_check;
alter table clinic.inventory_movements drop constraint if exists inventory_movements_type_check;
alter table clinic.inventory_movements
  add constraint inventory_movements_quantity_check
    check (quantity_delta <> 0 or movement_type = 'transfer'),
  add constraint inventory_movements_type_check
    check (movement_type in (
      'opening','receipt','adjustment_in','adjustment_out','dispense','reversal',
      'consume','transfer','stock_count','write_off'
    ));

create table clinic.inventory_movement_batches (
  movement_id bigint not null references clinic.inventory_movements(id) on delete restrict,
  inventory_batch_id uuid not null references clinic.inventory_batches(id) on delete restrict,
  quantity numeric(14,3) not null constraint inventory_movement_batches_quantity_check check (quantity > 0),
  primary key (movement_id, inventory_batch_id)
);

create table clinic.inventory_stock_counts (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  location_id uuid not null references clinic.inventory_locations(id) on delete restrict,
  system_quantity numeric(14,3) not null check (system_quantity >= 0),
  counted_quantity numeric(14,3) not null check (counted_quantity >= 0),
  variance numeric(14,3) not null,
  reason text not null check (btrim(reason) <> ''),
  counted_by uuid not null references clinic.users(id) on delete restrict,
  counted_at timestamptz not null default now()
);

create index inventory_stock_counts_item_location_idx
  on clinic.inventory_stock_counts (catalog_item_id, location_id, counted_at desc);

create table clinic.inventory_operations (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references clinic.users(id) on delete restrict,
  operation_type text not null,
  idempotency_key text not null,
  response_data jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (actor_user_id, operation_type, idempotency_key),
  constraint inventory_operations_key_not_blank check (btrim(idempotency_key) <> '')
);
