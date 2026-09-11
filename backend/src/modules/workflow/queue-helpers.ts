import type { PoolClient } from "pg";

export async function enqueueBillingIfNeeded(
  client: PoolClient,
  visitId: string,
  actorUserId: string,
  notes = "Ready for billing",
): Promise<void> {
  const active = await client.query(
    `select 1 from clinic.queue_entries
     where visit_id=$1 and station='billing' and status in ('waiting','called','in_service')
     limit 1`,
    [visitId],
  );
  if (active.rowCount) return;

  const created = await client.query<{ id: string }>(
    `insert into clinic.queue_entries (visit_id, station, priority)
     select id, 'billing', priority from clinic.visits where id=$1
     returning id`,
    [visitId],
  );
  await client.query(
    `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes)
     values ($1, null, 'waiting', $2, $3)`,
    [created.rows[0]!.id, actorUserId, notes],
  );
}

/** Close active billing queue tickets once the invoice is fully paid. */
export async function completeBillingQueue(
  client: PoolClient,
  visitId: string,
  actorUserId: string,
  notes = "Invoice paid in full",
): Promise<void> {
  const active = await client.query<{ id: string; status: string }>(
    `select id, status from clinic.queue_entries
     where visit_id=$1 and station='billing' and status in ('waiting','called','in_service')
     for update`,
    [visitId],
  );
  for (const entry of active.rows) {
    await client.query(
      `update clinic.queue_entries
       set status='completed', completed_at=now(), updated_at=now()
       where id=$1`,
      [entry.id],
    );
    await client.query(
      `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes)
       values ($1, $2, 'completed', $3, $4)`,
      [entry.id, entry.status, actorUserId, notes],
    );
  }
}
