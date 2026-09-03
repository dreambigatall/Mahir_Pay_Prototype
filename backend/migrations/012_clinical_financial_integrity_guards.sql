create function clinic.guard_encounter_signing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'signed' and exists (
    select 1 from clinic.diagnostic_orders o
    where o.encounter_id = new.id and o.status not in ('reviewed', 'cancelled')
  ) then
    raise exception using
      errcode = '23514',
      message = 'All diagnostic orders must be reviewed before signing the encounter';
  end if;
  return new;
end;
$$;

revoke all on function clinic.guard_encounter_signing() from public;

create trigger encounters_guard_signing_trigger
before update of status on clinic.encounters
for each row execute function clinic.guard_encounter_signing();

create function clinic.guard_invoice_charge_coverage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from (
      select pi.catalog_item_id, sum(pi.quantity_prescribed) as required_quantity
      from clinic.prescriptions p
      join clinic.prescription_items pi on pi.prescription_id = p.id
      where p.visit_id = new.visit_id and p.status <> 'cancelled'
      group by pi.catalog_item_id
    ) required
    where coalesce((
      select sum(il.quantity) from clinic.invoice_lines il
      where il.invoice_id = new.id and il.catalog_item_id = required.catalog_item_id
    ), 0) < required.required_quantity
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invoice does not include all prescribed medication charges';
  end if;

  if exists (
    select 1
    from (
      select di.catalog_item_id, count(*)::numeric as required_quantity
      from clinic.diagnostic_orders d
      join clinic.diagnostic_order_items di on di.diagnostic_order_id = d.id
      where d.visit_id = new.visit_id and d.status <> 'cancelled'
      group by di.catalog_item_id
    ) required
    where coalesce((
      select sum(il.quantity) from clinic.invoice_lines il
      where il.invoice_id = new.id and il.catalog_item_id = required.catalog_item_id
    ), 0) < required.required_quantity
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invoice does not include all diagnostic charges';
  end if;
  return new;
end;
$$;

revoke all on function clinic.guard_invoice_charge_coverage() from public;

create constraint trigger invoices_charge_coverage_trigger
after insert on clinic.invoices
deferrable initially deferred
for each row execute function clinic.guard_invoice_charge_coverage();
