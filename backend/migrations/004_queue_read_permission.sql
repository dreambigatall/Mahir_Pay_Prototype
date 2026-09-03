insert into clinic.permissions (slug, description)
values ('queue.read', 'View active operational queues')
on conflict (slug) do update set description = excluded.description;

insert into clinic.role_permissions (role_id, permission_id)
select r.id, p.id
from clinic.roles r
join clinic.permissions p on p.slug = 'queue.read'
where r.slug in ('admin', 'receptionist', 'doctor', 'lab', 'nurse')
on conflict do nothing;
