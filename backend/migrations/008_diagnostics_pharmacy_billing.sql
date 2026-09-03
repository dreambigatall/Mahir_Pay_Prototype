create sequence clinic.catalog_code_seq start with 1000;
create sequence clinic.invoice_number_seq start with 1000;
create sequence clinic.receipt_number_seq start with 1000;

create table clinic.catalog_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique
    default ('CAT-' || lpad(nextval('clinic.catalog_code_seq')::text, 6, '0')),
  item_type text not null constraint catalog_items_type_check
    check (item_type in ('consultation', 'lab_test', 'radiology', 'drug', 'procedure')),
  name text not null,
  description text,
  unit text,
  price numeric(12,2) not null constraint catalog_items_price_check check (price >= 0),
  track_inventory boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references clinic.users(id) on delete restrict,
  updated_by uuid not null references clinic.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_name_not_blank_check check (btrim(name) <> ''),
  constraint catalog_items_inventory_type_check check (not track_inventory or item_type = 'drug')
);

alter sequence clinic.catalog_code_seq owned by clinic.catalog_items.item_code;
create unique index catalog_items_type_name_uidx on clinic.catalog_items (item_type, lower(name));
create index catalog_items_active_type_name_idx on clinic.catalog_items (item_type, lower(name), id)
  where active = true;
create index catalog_items_created_by_idx on clinic.catalog_items (created_by);
create index catalog_items_updated_by_idx on clinic.catalog_items (updated_by);

create table clinic.inventory_balances (
  catalog_item_id uuid primary key references clinic.catalog_items(id) on delete restrict,
  quantity_on_hand numeric(14,3) not null default 0
    constraint inventory_balances_quantity_check check (quantity_on_hand >= 0),
  reorder_level numeric(14,3) not null default 0
    constraint inventory_balances_reorder_check check (reorder_level >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table clinic.inventory_movements (
  id bigint generated always as identity primary key,
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  movement_type text not null constraint inventory_movements_type_check
    check (movement_type in ('opening', 'receipt', 'adjustment_in', 'adjustment_out', 'dispense', 'reversal')),
  quantity_delta numeric(14,3) not null constraint inventory_movements_quantity_check
    check (quantity_delta <> 0),
  balance_after numeric(14,3) not null constraint inventory_movements_balance_check
    check (balance_after >= 0),
  reference_type text,
  reference_id text,
  reason text,
  actor_user_id uuid not null references clinic.users(id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create index inventory_movements_item_occurred_idx
  on clinic.inventory_movements (catalog_item_id, occurred_at desc);
create index inventory_movements_actor_user_id_idx on clinic.inventory_movements (actor_user_id);

create table clinic.diagnostic_orders (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references clinic.visits(id) on delete restrict,
  encounter_id uuid not null references clinic.encounters(id) on delete restrict,
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  ordered_by uuid not null references clinic.users(id) on delete restrict,
  urgency text not null default 'routine'
    constraint diagnostic_orders_urgency_check check (urgency in ('routine', 'urgent')),
  status text not null default 'requested' constraint diagnostic_orders_status_check
    check (status in ('requested', 'in_progress', 'result_ready', 'verified', 'reviewed', 'cancelled')),
  clinical_notes text,
  ordered_at timestamptz not null default now(),
  reviewed_by uuid references clinic.users(id) on delete restrict,
  reviewed_at timestamptz,
  cancelled_by uuid references clinic.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  updated_at timestamptz not null default now(),
  constraint diagnostic_orders_review_check
    check ((status = 'reviewed') = (reviewed_by is not null and reviewed_at is not null)),
  constraint diagnostic_orders_cancel_check
    check ((status = 'cancelled') = (cancelled_by is not null and cancelled_at is not null))
);

create index diagnostic_orders_visit_ordered_idx on clinic.diagnostic_orders (visit_id, ordered_at desc);
create index diagnostic_orders_encounter_id_idx on clinic.diagnostic_orders (encounter_id);
create index diagnostic_orders_patient_ordered_idx on clinic.diagnostic_orders (patient_id, ordered_at desc);
create index diagnostic_orders_ordered_by_idx on clinic.diagnostic_orders (ordered_by);
create index diagnostic_orders_reviewed_by_idx on clinic.diagnostic_orders (reviewed_by) where reviewed_by is not null;
create index diagnostic_orders_cancelled_by_idx on clinic.diagnostic_orders (cancelled_by) where cancelled_by is not null;
create index diagnostic_orders_worklist_idx on clinic.diagnostic_orders (urgency, ordered_at, id)
  where status in ('requested', 'in_progress', 'result_ready');

create table clinic.diagnostic_order_items (
  id uuid primary key default gen_random_uuid(),
  diagnostic_order_id uuid not null references clinic.diagnostic_orders(id) on delete cascade,
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  item_name text not null,
  item_type text not null constraint diagnostic_order_items_type_check
    check (item_type in ('lab_test', 'radiology')),
  status text not null default 'requested' constraint diagnostic_order_items_status_check
    check (status in ('requested', 'in_progress', 'result_ready', 'verified', 'reviewed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (diagnostic_order_id, catalog_item_id)
);

create index diagnostic_order_items_catalog_item_id_idx on clinic.diagnostic_order_items (catalog_item_id);
create index diagnostic_order_items_active_order_idx on clinic.diagnostic_order_items (diagnostic_order_id, status)
  where status not in ('reviewed', 'cancelled');

create table clinic.diagnostic_results (
  id uuid primary key default gen_random_uuid(),
  diagnostic_order_item_id uuid not null unique
    references clinic.diagnostic_order_items(id) on delete restrict,
  result_value text not null,
  result_unit text,
  result_flag text constraint diagnostic_results_flag_check
    check (result_flag is null or result_flag in ('normal', 'abnormal', 'critical')),
  reference_range text,
  notes text,
  entered_by uuid not null references clinic.users(id) on delete restrict,
  entered_at timestamptz not null default now(),
  verified_by uuid references clinic.users(id) on delete restrict,
  verified_at timestamptz,
  corrected_from_id uuid references clinic.diagnostic_results(id) on delete restrict,
  correction_reason text,
  constraint diagnostic_results_value_not_blank_check check (btrim(result_value) <> ''),
  constraint diagnostic_results_verification_check
    check ((verified_by is null and verified_at is null) or (verified_by is not null and verified_at is not null)),
  constraint diagnostic_results_correction_check
    check ((corrected_from_id is null and correction_reason is null)
      or (corrected_from_id is not null and btrim(correction_reason) <> ''))
);

create index diagnostic_results_entered_by_idx on clinic.diagnostic_results (entered_by);
create index diagnostic_results_verified_by_idx on clinic.diagnostic_results (verified_by) where verified_by is not null;
create index diagnostic_results_corrected_from_id_idx on clinic.diagnostic_results (corrected_from_id)
  where corrected_from_id is not null;

create table clinic.prescriptions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references clinic.visits(id) on delete restrict,
  encounter_id uuid not null references clinic.encounters(id) on delete restrict,
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  prescriber_id uuid not null references clinic.users(id) on delete restrict,
  status text not null default 'awaiting_payment' constraint prescriptions_status_check
    check (status in ('awaiting_payment', 'payment_approved', 'partially_dispensed', 'dispensed', 'cancelled')),
  notes text,
  prescribed_at timestamptz not null default now(),
  cancelled_by uuid references clinic.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  updated_at timestamptz not null default now(),
  constraint prescriptions_cancel_check
    check ((status = 'cancelled') = (cancelled_by is not null and cancelled_at is not null))
);

create index prescriptions_visit_prescribed_idx on clinic.prescriptions (visit_id, prescribed_at desc);
create index prescriptions_encounter_id_idx on clinic.prescriptions (encounter_id);
create index prescriptions_patient_prescribed_idx on clinic.prescriptions (patient_id, prescribed_at desc);
create index prescriptions_prescriber_id_idx on clinic.prescriptions (prescriber_id);
create index prescriptions_cancelled_by_idx on clinic.prescriptions (cancelled_by) where cancelled_by is not null;
create index prescriptions_pharmacy_worklist_idx on clinic.prescriptions (status, prescribed_at, id)
  where status in ('payment_approved', 'partially_dispensed');

create table clinic.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references clinic.prescriptions(id) on delete cascade,
  catalog_item_id uuid not null references clinic.catalog_items(id) on delete restrict,
  drug_name text not null,
  dosage text not null,
  frequency text not null,
  duration text not null,
  instructions text,
  quantity_prescribed numeric(12,3) not null
    constraint prescription_items_quantity_check check (quantity_prescribed > 0),
  quantity_dispensed numeric(12,3) not null default 0
    constraint prescription_items_dispensed_check check (
      quantity_dispensed >= 0 and quantity_dispensed <= quantity_prescribed
    ),
  unit_price numeric(12,2) not null constraint prescription_items_price_check check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (prescription_id, catalog_item_id)
);

create index prescription_items_catalog_item_id_idx on clinic.prescription_items (catalog_item_id);

create table clinic.dispensing_events (
  id uuid primary key default gen_random_uuid(),
  prescription_item_id uuid not null references clinic.prescription_items(id) on delete restrict,
  quantity numeric(12,3) not null constraint dispensing_events_quantity_check check (quantity > 0),
  dispensed_by uuid not null references clinic.users(id) on delete restrict,
  notes text,
  dispensed_at timestamptz not null default now()
);

create index dispensing_events_item_dispensed_idx
  on clinic.dispensing_events (prescription_item_id, dispensed_at);
create index dispensing_events_dispensed_by_idx on clinic.dispensing_events (dispensed_by);

create table clinic.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
    default ('INV-' || lpad(nextval('clinic.invoice_number_seq')::text, 6, '0')),
  visit_id uuid not null unique references clinic.visits(id) on delete restrict,
  patient_id uuid not null references clinic.patients(id) on delete restrict,
  status text not null default 'draft' constraint invoices_status_check
    check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  subtotal numeric(12,2) not null constraint invoices_subtotal_check check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0
    constraint invoices_discount_check check (discount_amount >= 0 and discount_amount <= subtotal),
  total numeric(12,2) not null constraint invoices_total_check check (total >= 0),
  amount_paid numeric(12,2) not null default 0
    constraint invoices_amount_paid_check check (amount_paid >= 0 and amount_paid <= total),
  discount_reason text,
  discount_approved_by uuid references clinic.users(id) on delete restrict,
  issued_by uuid not null references clinic.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_by uuid references clinic.users(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  updated_at timestamptz not null default now(),
  constraint invoices_total_math_check check (total = subtotal - discount_amount),
  constraint invoices_discount_approval_check
    check ((discount_amount = 0 and discount_approved_by is null)
      or (discount_amount > 0 and discount_approved_by is not null and btrim(discount_reason) <> '')),
  constraint invoices_paid_check check ((status = 'paid') = (paid_at is not null)),
  constraint invoices_void_check
    check ((status = 'void') = (voided_by is not null and voided_at is not null and btrim(void_reason) <> ''))
);

alter sequence clinic.invoice_number_seq owned by clinic.invoices.invoice_number;
create index invoices_patient_issued_idx on clinic.invoices (patient_id, issued_at desc);
create index invoices_issued_by_idx on clinic.invoices (issued_by);
create index invoices_discount_approved_by_idx on clinic.invoices (discount_approved_by)
  where discount_approved_by is not null;
create index invoices_voided_by_idx on clinic.invoices (voided_by) where voided_by is not null;
create index invoices_outstanding_idx on clinic.invoices (issued_at, id)
  where status in ('issued', 'partially_paid');

create table clinic.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references clinic.invoices(id) on delete cascade,
  catalog_item_id uuid references clinic.catalog_items(id) on delete restrict,
  line_type text not null constraint invoice_lines_type_check
    check (line_type in ('consultation', 'lab_test', 'radiology', 'drug', 'procedure', 'other')),
  description text not null,
  quantity numeric(12,3) not null constraint invoice_lines_quantity_check check (quantity > 0),
  unit_price numeric(12,2) not null constraint invoice_lines_price_check check (unit_price >= 0),
  line_total numeric(12,2) not null constraint invoice_lines_total_check check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint invoice_lines_description_check check (btrim(description) <> ''),
  constraint invoice_lines_math_check check (line_total = round(quantity * unit_price, 2))
);

create index invoice_lines_invoice_id_idx on clinic.invoice_lines (invoice_id);
create index invoice_lines_catalog_item_id_idx on clinic.invoice_lines (catalog_item_id)
  where catalog_item_id is not null;

create table clinic.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique
    default ('RCT-' || lpad(nextval('clinic.receipt_number_seq')::text, 6, '0')),
  invoice_id uuid not null references clinic.invoices(id) on delete restrict,
  amount numeric(12,2) not null constraint payments_amount_check check (amount > 0),
  method text not null constraint payments_method_check
    check (method in ('cash', 'card', 'mobile_money', 'bank_transfer', 'credit')),
  reference text,
  status text not null default 'completed' constraint payments_status_check
    check (status in ('completed', 'reversed')),
  collected_by uuid not null references clinic.users(id) on delete restrict,
  paid_at timestamptz not null default now(),
  reversed_by uuid references clinic.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  constraint payments_reversal_check
    check ((status = 'reversed') = (reversed_by is not null and reversed_at is not null and btrim(reversal_reason) <> ''))
);

alter sequence clinic.receipt_number_seq owned by clinic.payments.receipt_number;
create index payments_invoice_paid_idx on clinic.payments (invoice_id, paid_at);
create index payments_collected_by_idx on clinic.payments (collected_by);
create index payments_reversed_by_idx on clinic.payments (reversed_by) where reversed_by is not null;
