-- Allow medicine release on credit while balance stays on the same invoice.
alter table clinic.invoices
  add column if not exists due_at date,
  add column if not exists credit_approved_by uuid references clinic.users(id) on delete restrict,
  add column if not exists credit_approved_at timestamptz,
  add column if not exists credit_note text;

alter table clinic.invoices
  drop constraint if exists invoices_credit_approval_check;

alter table clinic.invoices
  add constraint invoices_credit_approval_check check (
    (credit_approved_by is null and credit_approved_at is null and due_at is null and credit_note is null)
    or (
      credit_approved_by is not null
      and credit_approved_at is not null
      and due_at is not null
      and (credit_note is null or btrim(credit_note) <> '')
    )
  );

create index if not exists invoices_credit_due_idx
  on clinic.invoices (due_at, id)
  where status in ('issued', 'partially_paid') and credit_approved_at is not null;

insert into clinic.permissions (slug, description)
values ('billing.credit', 'Authorize medication release while invoice balance remains due')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = 'billing.credit'
where r.slug in ('admin', 'receptionist')
on conflict do nothing;
