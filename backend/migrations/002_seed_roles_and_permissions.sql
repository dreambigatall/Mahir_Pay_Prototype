insert into clinic.roles (slug, name, description)
values
  ('admin', 'Administrator', 'Clinic configuration, staff, reporting, and overrides'),
  ('receptionist', 'Receptionist', 'Patient registration, queue, billing, and payments'),
  ('doctor', 'Doctor', 'Consultation, diagnostics, prescriptions, and clinical completion'),
  ('lab', 'Lab Technician', 'Diagnostic worklist, results, and verification'),
  ('nurse', 'Nurse / Triage', 'Triage, observations, and procedure administration')
on conflict (slug) do update
set name = excluded.name, description = excluded.description;

insert into clinic.permissions (slug, description)
values
  ('staff.manage', 'Create, edit, disable, and assign staff roles'),
  ('roles.read', 'View available roles and permissions'),
  ('patient.read', 'View patient records'),
  ('patient.create', 'Register patients'),
  ('patient.update', 'Update patient demographics and safety information'),
  ('queue.manage', 'Check in, transfer, cancel, and manage queue entries'),
  ('encounter.read', 'View clinical encounters'),
  ('encounter.start', 'Start a consultation encounter'),
  ('encounter.document', 'Record clinical encounter information'),
  ('encounter.sign', 'Sign or amend clinical documentation'),
  ('diagnostic.order', 'Create diagnostic orders'),
  ('diagnostic.worklist', 'View and manage the diagnostic worklist'),
  ('diagnostic.result.enter', 'Enter diagnostic results'),
  ('diagnostic.result.verify', 'Verify or correct diagnostic results'),
  ('prescription.create', 'Create and sign prescriptions'),
  ('medication.dispense', 'Record medication dispensing'),
  ('procedure.administer', 'Record procedure or vaccine administration'),
  ('invoice.issue', 'Create and issue invoices'),
  ('payment.collect', 'Collect and allocate payments'),
  ('discount.approve', 'Approve discounts and financial adjustments'),
  ('reports.read', 'View operational and financial reports')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
cross join clinic.permissions p
where r.slug = 'admin'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any (array[
  'roles.read', 'patient.read', 'patient.create', 'patient.update', 'queue.manage',
  'encounter.read', 'invoice.issue', 'payment.collect'
])
where r.slug = 'receptionist'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any (array[
  'roles.read', 'patient.read', 'encounter.read', 'encounter.start',
  'encounter.document', 'encounter.sign', 'diagnostic.order',
  'prescription.create', 'procedure.administer'
])
where r.slug = 'doctor'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any (array[
  'roles.read', 'patient.read', 'encounter.read', 'diagnostic.worklist',
  'diagnostic.result.enter', 'diagnostic.result.verify'
])
where r.slug = 'lab'
on conflict do nothing;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = any (array[
  'roles.read', 'patient.read', 'patient.update', 'queue.manage',
  'encounter.read', 'encounter.document', 'procedure.administer'
])
where r.slug = 'nurse'
on conflict do nothing;
