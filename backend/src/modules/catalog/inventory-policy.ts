import { AppError } from "../../shared/errors/app-error";

export type FefoBatch = {
  id: string;
  quantity: number;
  expiryDate: string | null;
  locationId: string;
};
export type BatchAllocation = FefoBatch & { allocated: number };

export function planFefoAllocation(
  batches: FefoBatch[],
  requested: number,
  today = new Date().toISOString().slice(0, 10),
): BatchAllocation[] {
  const usable = batches
    .filter(
      (batch) =>
        batch.quantity > 0 && (!batch.expiryDate || batch.expiryDate >= today),
    )
    .sort((a, b) => {
      if (!a.expiryDate) return b.expiryDate ? 1 : a.id.localeCompare(b.id);
      if (!b.expiryDate) return -1;
      return (
        a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id)
      );
    });
  const available = usable.reduce((sum, batch) => sum + batch.quantity, 0);
  if (requested > available)
    throw new AppError(
      409,
      "INSUFFICIENT_USABLE_STOCK",
      `Only ${available} non-expired units are available`,
    );
  let remaining = requested;
  const allocations: BatchAllocation[] = [];
  for (const batch of usable) {
    if (remaining <= 0) break;
    const allocated = Math.min(remaining, batch.quantity);
    allocations.push({ ...batch, allocated });
    remaining -= allocated;
  }
  return allocations;
}

export function batchBalanceIsConsistent(
  batchTotal: number,
  locationTotal: number,
) {
  return Math.abs(batchTotal - locationTotal) < 0.0005;
}
