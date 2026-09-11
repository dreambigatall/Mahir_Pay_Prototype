-- Internal clinic supplies (reagents, kits, needles) tracked separately from billed drugs.

alter table clinic.catalog_items
  drop constraint if exists catalog_items_type_check;

alter table clinic.catalog_items
  add constraint catalog_items_type_check
  check (item_type in (
    'consultation', 'lab_test', 'radiology', 'drug', 'procedure', 'lab_panel', 'supply'
  ));

alter table clinic.catalog_items
  drop constraint if exists catalog_items_inventory_type_check;

alter table clinic.catalog_items
  add constraint catalog_items_inventory_type_check
  check (not track_inventory or item_type in ('drug', 'supply'));

alter table clinic.catalog_items
  add column if not exists supply_kind text;

alter table clinic.catalog_items
  drop constraint if exists catalog_items_supply_kind_check;

alter table clinic.catalog_items
  add constraint catalog_items_supply_kind_check
  check (
    (item_type = 'supply' and supply_kind in ('reagent', 'test_kit', 'needle', 'other'))
    or (item_type <> 'supply' and supply_kind is null)
  );

alter table clinic.catalog_items
  drop constraint if exists catalog_items_supply_tracked_check;

alter table clinic.catalog_items
  add constraint catalog_items_supply_tracked_check
  check (item_type <> 'supply' or track_inventory = true);

alter table clinic.inventory_movements
  drop constraint if exists inventory_movements_type_check;

alter table clinic.inventory_movements
  add constraint inventory_movements_type_check
  check (movement_type in (
    'opening', 'receipt', 'adjustment_in', 'adjustment_out', 'dispense', 'reversal', 'consume'
  ));
