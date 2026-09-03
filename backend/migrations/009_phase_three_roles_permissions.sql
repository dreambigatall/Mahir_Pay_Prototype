insert into clinic.roles (slug, name, description)
values ('pharmacist', 'Pharmacist', 'Medication review, stock control, and dispensing')
on conflict (slug) do update set name=excluded.name, description=excluded.description;

insert into clinic.permissions (slug, description)
values
  ('catalog.read', 'View clinic services, tests, drugs, procedures, and prices'),
  ('catalog.manage', 'Create and update catalog items and pricing'),
  ('inventory.manage', 'Receive and adjust tracked medication inventory'),
  ('billing.read', 'View invoices, balances, and payment history')
on conflict (slug) do update set description=excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r
join clinic.permissions p on p.slug = any(array['catalog.read', 'billing.read'])
where r.slug = 'receptionist'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r
join clinic.permissions p on p.slug = 'catalog.read'
where r.slug in ('doctor', 'lab', 'nurse')
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r
join clinic.permissions p on p.slug = any(array[
  'roles.read', 'patient.read', 'encounter.read', 'queue.read', 'catalog.read',
  'medication.dispense', 'inventory.manage', 'billing.read'
])
where r.slug = 'pharmacist'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id from clinic.roles r cross join clinic.permissions p
where r.slug = 'admin'
on conflict do nothing;
