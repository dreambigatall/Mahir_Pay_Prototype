create table clinic.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  batch_number text not null,
  supplier_name text not null,
  purchase_reference text,
  received_quantity numeric(14,3) not null
    constraint inventory_batches_received_quantity_check check (received_quantity > 0),
  quantity_remaining numeric(14,3) not null
    constraint inventory_batches_remaining_check check (
      quantity_remaining >= 0 and quantity_remaining <= received_quantity
    ),
  expiry_date date,
  unit_cost numeric(12,2) constraint inventory_batches_unit_cost_check check (unit_cost is null or unit_cost >= 0),
  received_by uuid not null references clinic.users(id) on delete restrict,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_batches_number_not_blank_check check (btrim(batch_number) <> ''),
  constraint inventory_batches_supplier_not_blank_check check (btrim(supplier_name) <> ''),
  unique (catalog_item_id, batch_number)
);

create index inventory_batches_fefo_idx
  on clinic.inventory_batches (catalog_item_id, expiry_date, received_at, id)
  where quantity_remaining > 0;
create index inventory_batches_expiry_idx
  on clinic.inventory_batches (expiry_date, catalog_item_id)
  where quantity_remaining > 0 and expiry_date is not null;
create index inventory_batches_received_by_idx on clinic.inventory_batches (received_by);

alter table clinic.inventory_movements
  add column batch_id uuid references clinic.inventory_batches(id) on delete restrict;
create index inventory_movements_batch_id_idx on clinic.inventory_movements (batch_id)
  where batch_id is not null;

create table clinic.dispensing_batch_allocations (
  id bigint generated always as identity primary key,
  dispensing_event_id uuid not null references clinic.dispensing_events(id) on delete restrict,
  inventory_batch_id uuid not null references clinic.inventory_batches(id) on delete restrict,
  quantity numeric(12,3) not null
    constraint dispensing_batch_allocations_quantity_check check (quantity > 0),
  unique (dispensing_event_id, inventory_batch_id)
);

create index dispensing_batch_allocations_batch_id_idx
  on clinic.dispensing_batch_allocations (inventory_batch_id);
