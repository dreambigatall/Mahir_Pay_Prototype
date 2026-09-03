create function clinic.cancel_visit_when_queue_cancelled()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    update clinic.visits
    set status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Active queue entry cancelled',
        updated_at = now()
    where id = new.visit_id
      and status not in ('completed', 'billed', 'cancelled');

    update clinic.appointments
    set status = 'cancelled',
        cancelled_by = new.assigned_user_id,
        cancelled_at = now(),
        cancellation_reason = 'Visit cancelled after check-in',
        updated_at = now()
    where id = (select appointment_id from clinic.visits where id = new.visit_id)
      and status = 'checked_in';
  end if;
  return new;
end;
$$;

revoke all on function clinic.cancel_visit_when_queue_cancelled() from public;

create trigger queue_entries_cancel_visit_trigger
after update of status on clinic.queue_entries
for each row
execute function clinic.cancel_visit_when_queue_cancelled();
