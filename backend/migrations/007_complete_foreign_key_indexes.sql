-- Partial operational indexes optimize hot queues, but foreign-key checks also
-- need coverage for historical rows that no longer satisfy active predicates.
create index appointments_doctor_id_idx on clinic.appointments (doctor_id)
where doctor_id is not null;

create index visits_doctor_id_idx on clinic.visits (doctor_id)
where doctor_id is not null;

create index queue_entries_visit_id_idx on clinic.queue_entries (visit_id);

create index queue_entries_assigned_user_id_idx on clinic.queue_entries (assigned_user_id)
where assigned_user_id is not null;
