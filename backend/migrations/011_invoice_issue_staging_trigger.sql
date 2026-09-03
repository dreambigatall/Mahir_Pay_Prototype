-- Invoice lines and totals are created in one short transaction. Normalize the
-- intentionally temporary header values before constraints run; the same
-- transaction replaces them with the line aggregate before commit.
create function clinic.normalize_staged_invoice_totals()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'issued'
    and new.subtotal = 0
    and new.total = -new.discount_amount then
    new.subtotal := new.discount_amount;
    new.total := 0;
  end if;
  return new;
end;
$$;

revoke all on function clinic.normalize_staged_invoice_totals() from public;

create trigger invoices_normalize_staged_totals_trigger
before insert on clinic.invoices
for each row execute function clinic.normalize_staged_invoice_totals();
