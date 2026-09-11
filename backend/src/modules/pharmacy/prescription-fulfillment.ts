import type { PoolClient } from "pg";
import { AppError } from "../../shared/errors/app-error";
import { planFefoAllocation } from "../catalog/inventory-policy";

type PrescriptionItemRow = {
  id: string;
  catalog_item_id: string;
  quantity_prescribed: string;
  quantity_dispensed: string;
  track_inventory: boolean;
};

/**
 * Deducts pharmacy stock (FEFO) and records dispensing for the given item quantities.
 * Safe to call from payment completion or pharmacist dispense; only remaining qty can be fulfilled.
 */
export async function fulfillPrescriptionItems(
  c: PoolClient,
  prescriptionId: string,
  requests: Array<{ prescriptionItemId: string; quantity: number }>,
  actor: string,
  notes?: string | null,
): Promise<{ visitId: string; status: "dispensed" | "partially_dispensed" }> {
  const rxr = await c.query<{ id: string; visit_id: string; status: string }>(
    "select id,visit_id,status from clinic.prescriptions where id=$1 for update",
    [prescriptionId],
  );
  const rx = rxr.rows[0];
  if (!rx) throw new AppError(404, "PRESCRIPTION_NOT_FOUND", "Prescription was not found");
  if (!["payment_approved", "partially_dispensed"].includes(rx.status)) {
    throw new AppError(
      409,
      "PRESCRIPTION_NOT_DISPENSABLE",
      "Prescription is not approved for dispensing",
    );
  }

  const rows = await c.query<PrescriptionItemRow>(
    `select i.id,i.catalog_item_id,i.quantity_prescribed::text,i.quantity_dispensed::text,d.track_inventory
     from clinic.prescription_items i
     join clinic.catalog_items d on d.id=i.catalog_item_id
     where i.prescription_id=$1 and i.id=any($2::uuid[])
     order by i.catalog_item_id,i.id
     for update of i`,
    [prescriptionId, requests.map((x) => x.prescriptionItemId)],
  );
  if (rows.rowCount !== requests.length) {
    throw new AppError(
      400,
      "PRESCRIPTION_ITEM_INVALID",
      "One or more items do not belong to this prescription",
    );
  }

  const tracked = rows.rows.filter((x) => x.track_inventory).map((x) => x.catalog_item_id).sort();
  const balances = tracked.length
    ? await c.query<{ catalog_item_id: string; quantity_on_hand: string }>(
        "select catalog_item_id,quantity_on_hand::text from clinic.inventory_balances where catalog_item_id=any($1::uuid[]) order by catalog_item_id for update",
        [tracked],
      )
    : { rows: [] as Array<{ catalog_item_id: string; quantity_on_hand: string }> };
  const balanceMap = new Map(balances.rows.map((x) => [x.catalog_item_id, Number(x.quantity_on_hand)]));
  const requestMap = new Map(requests.map((x) => [x.prescriptionItemId, x.quantity]));

  for (const item of rows.rows) {
    const qty = requestMap.get(item.id)!;
    const remaining = Number(item.quantity_prescribed) - Number(item.quantity_dispensed);
    if (qty > remaining) {
      throw new AppError(
        409,
        "DISPENSE_QUANTITY_EXCEEDED",
        `Dispense quantity exceeds remaining amount for item ${item.id}`,
      );
    }
    if (qty <= 0) continue;

    const allocations: Array<{ batchId: string; quantity: number }> = [];
    if (item.track_inventory) {
      const stock = balanceMap.get(item.catalog_item_id);
      if (stock === undefined) {
        throw new AppError(409, "INVENTORY_BALANCE_MISSING", "Tracked drug has no inventory balance");
      }
      const batches = await c.query<{
        id: string;
        quantity_remaining: string;
        expiry_date: string | null;
        location_id: string;
      }>(
        `select b.id,s.quantity::text quantity_remaining,b.expiry_date::text,s.location_id
         from clinic.inventory_batches b
         join clinic.inventory_batch_stocks s on s.inventory_batch_id=b.id
         join clinic.inventory_locations l on l.id=s.location_id
         where b.catalog_item_id=$1 and s.quantity>0 and l.code='pharmacy'
         order by b.expiry_date asc nulls last,b.received_at,b.id
         for update of b,s`,
        [item.catalog_item_id],
      );
      if (qty > stock) {
        throw new AppError(
          409,
          "INSUFFICIENT_USABLE_STOCK",
          `Only ${stock} units are on hand for prescription item ${item.id}`,
        );
      }
      const planned = planFefoAllocation(
        batches.rows.map((batch) => ({
          id: batch.id,
          quantity: Number(batch.quantity_remaining),
          expiryDate: batch.expiry_date,
          locationId: batch.location_id,
        })),
        qty,
      );
      for (const allocation of planned) {
        await c.query("update clinic.inventory_batches set quantity_remaining=quantity_remaining-$2 where id=$1", [
          allocation.id,
          allocation.allocated,
        ]);
        await c.query(
          "update clinic.inventory_batch_stocks set quantity=quantity-$3,updated_at=now() where inventory_batch_id=$1 and location_id=$2",
          [allocation.id, allocation.locationId, allocation.allocated],
        );
        allocations.push({ batchId: allocation.id, quantity: allocation.allocated });
      }
      const next = stock - qty;
      balanceMap.set(item.catalog_item_id, next);
      await c.query(
        "update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",
        [item.catalog_item_id, next],
      );
      await c.query(
        `insert into clinic.inventory_movements(catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reference_type,reference_id,actor_user_id,transaction_reference)
         values($1,'dispense',$2,$6,$3,'prescription',$4,$5,$4)`,
        [item.catalog_item_id, -qty, next, prescriptionId, actor, qty],
      );
    }

    await c.query("update clinic.prescription_items set quantity_dispensed=quantity_dispensed+$2 where id=$1", [
      item.id,
      qty,
    ]);
    const dispensing = await c.query<{ id: string }>(
      "insert into clinic.dispensing_events(prescription_item_id,quantity,dispensed_by,notes) values($1,$2,$3,$4) returning id",
      [item.id, qty, actor, notes ?? null],
    );
    for (const allocation of allocations) {
      await c.query(
        "insert into clinic.dispensing_batch_allocations(dispensing_event_id,inventory_batch_id,quantity) values($1,$2,$3)",
        [dispensing.rows[0]!.id, allocation.batchId, allocation.quantity],
      );
    }
  }

  const open = await c.query<{ count: string }>(
    "select count(*)::text count from clinic.prescription_items where prescription_id=$1 and quantity_dispensed<quantity_prescribed",
    [prescriptionId],
  );
  const status = Number(open.rows[0]!.count) === 0 ? "dispensed" : "partially_dispensed";
  await c.query("update clinic.prescriptions set status=$2,updated_at=now() where id=$1", [
    prescriptionId,
    status,
  ]);
  if (status === "dispensed") await completePharmacy(c, rx.visit_id);
  return { visitId: rx.visit_id, status };
}

/** Auto-fulfill every remaining line after the invoice is fully paid. */
export async function fulfillPaidPrescription(
  c: PoolClient,
  prescriptionId: string,
  actor: string,
): Promise<"dispensed" | "partially_dispensed"> {
  const items = await c.query<{ id: string; remaining: string }>(
    `select id,(quantity_prescribed-quantity_dispensed)::text remaining
     from clinic.prescription_items
     where prescription_id=$1 and quantity_dispensed<quantity_prescribed
     order by catalog_item_id,id`,
    [prescriptionId],
  );
  if (!items.rowCount) {
    await c.query("update clinic.prescriptions set status='dispensed',updated_at=now() where id=$1", [
      prescriptionId,
    ]);
    const visit = await c.query<{ visit_id: string }>(
      "select visit_id from clinic.prescriptions where id=$1",
      [prescriptionId],
    );
    await completePharmacy(c, visit.rows[0]!.visit_id);
    return "dispensed";
  }
  const result = await fulfillPrescriptionItems(
    c,
    prescriptionId,
    items.rows.map((item) => ({
      prescriptionItemId: item.id,
      quantity: Number(item.remaining),
    })),
    actor,
    "Auto-fulfilled on full payment",
  );
  return result.status;
}

export async function completePharmacy(c: PoolClient, visitId: string) {
  await c.query(
    `update clinic.queue_entries set status='completed',completed_at=now(),updated_at=now()
     where visit_id=$1 and station='pharmacy' and status in('waiting','called','in_service')`,
    [visitId],
  );
  const paid = await c.query("select 1 from clinic.invoices where visit_id=$1 and status='paid'", [
    visitId,
  ]);
  if (paid.rowCount) {
    await c.query(
      "update clinic.visits set status='billed',completed_at=now(),updated_at=now() where id=$1",
      [visitId],
    );
  }
}
