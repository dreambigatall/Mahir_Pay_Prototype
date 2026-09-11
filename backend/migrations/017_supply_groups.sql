-- User-defined clinic supply types (groups), replacing the fixed supply_kind enum.

create table clinic.supply_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references clinic.users(id) on delete restrict,
  updated_by uuid not null references clinic.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_groups_name_not_blank_check check (btrim(name) <> '')
);

create unique index supply_groups_name_uidx on clinic.supply_groups (lower(btrim(name)));
create index supply_groups_created_by_idx on clinic.supply_groups (created_by);

insert into clinic.supply_groups (name, created_by, updated_by)
select kind_name, u.id, u.id
from (
  values
    ('reagent', 'Lab reagents'),
    ('test_kit', 'Test kits'),
    ('needle', 'Needles and syringes'),
    ('other', 'Other supplies')
) as map(kind, kind_name)
cross join lateral (
  select id from clinic.users order by created_at, id limit 1
) u
where exists (
  select 1 from clinic.catalog_items c where c.item_type = 'supply' and c.supply_kind = map.kind
)
on conflict do nothing;

alter table clinic.catalog_items
  add column if not exists supply_group_id uuid references clinic.supply_groups(id) on delete restrict;

update clinic.catalog_items c
set supply_group_id = g.id
from clinic.supply_groups g
where c.item_type = 'supply'
  and c.supply_group_id is null
  and (
    (c.supply_kind = 'reagent' and lower(g.name) = 'lab reagents')
    or (c.supply_kind = 'test_kit' and lower(g.name) = 'test kits')
    or (c.supply_kind = 'needle' and lower(g.name) = 'needles and syringes')
    or (c.supply_kind = 'other' and lower(g.name) = 'other supplies')
  );

insert into clinic.supply_groups (name, created_by, updated_by)
select 'Clinic supplies', u.id, u.id
from (select id from clinic.users order by created_at, id limit 1) u
where exists (
  select 1 from clinic.catalog_items where item_type = 'supply' and supply_group_id is null
)
and not exists (
  select 1 from clinic.supply_groups where lower(name) = 'clinic supplies'
);

update clinic.catalog_items
set supply_group_id = (select id from clinic.supply_groups where lower(name) = 'clinic supplies' limit 1)
where item_type = 'supply' and supply_group_id is null;

alter table clinic.catalog_items
  drop constraint if exists catalog_items_supply_kind_check;

alter table clinic.catalog_items
  drop column if exists supply_kind;

alter table clinic.catalog_items
  drop constraint if exists catalog_items_supply_group_check;

alter table clinic.catalog_items
  add constraint catalog_items_supply_group_check
  check (
    (item_type = 'supply' and supply_group_id is not null)
    or (item_type <> 'supply' and supply_group_id is null)
  );

create index catalog_items_supply_group_id_idx
  on clinic.catalog_items (supply_group_id)
  where supply_group_id is not null;
