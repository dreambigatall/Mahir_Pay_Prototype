-- Lab order sets (panels): bundle multiple diagnostic catalog items for one-click ordering.

alter table clinic.catalog_items
  drop constraint if exists catalog_items_type_check;

alter table clinic.catalog_items
  add constraint catalog_items_type_check
  check (item_type in ('consultation', 'lab_test', 'radiology', 'drug', 'procedure', 'lab_panel'));

create table if not exists clinic.catalog_panel_members (
  panel_id uuid not null references clinic.catalog_items (id) on delete cascade,
  member_item_id uuid not null references clinic.catalog_items (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (panel_id, member_item_id)
);

create index if not exists catalog_panel_members_panel_sort_idx
  on clinic.catalog_panel_members (panel_id, sort_order, member_item_id);

create index if not exists catalog_panel_members_member_idx
  on clinic.catalog_panel_members (member_item_id);
