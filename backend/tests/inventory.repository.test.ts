import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  batchBalanceIsConsistent,
  planFefoAllocation,
} from "../src/modules/catalog/inventory-policy";

describe("inventory repository policy", () => {
  it("allocates FEFO and never allocates expired stock", () => {
    const allocations = planFefoAllocation(
      [
        {
          id: "later",
          quantity: 8,
          expiryDate: "2028-06-01",
          locationId: "store",
        },
        {
          id: "expired",
          quantity: 20,
          expiryDate: "2025-01-01",
          locationId: "store",
        },
        {
          id: "first",
          quantity: 4,
          expiryDate: "2027-02-01",
          locationId: "store",
        },
      ],
      6,
      "2026-09-04",
    );
    expect(allocations.map(({ id, allocated }) => ({ id, allocated }))).toEqual(
      [
        { id: "first", allocated: 4 },
        { id: "later", allocated: 2 },
      ],
    );
  });

  it("blocks consumption when usable stock is insufficient", () => {
    expect(() =>
      planFefoAllocation(
        [
          {
            id: "expired",
            quantity: 100,
            expiryDate: "2026-01-01",
            locationId: "store",
          },
          {
            id: "usable",
            quantity: 2,
            expiryDate: "2027-01-01",
            locationId: "store",
          },
        ],
        3,
        "2026-09-04",
      ),
    ).toThrow(/Only 2 non-expired units/);
  });

  it("detects batch and location balance drift", () => {
    expect(batchBalanceIsConsistent(12, 12)).toBe(true);
    expect(batchBalanceIsConsistent(12, 11.5)).toBe(false);
  });

  it("keeps concurrency and duplicate retry guards in the repository", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "src/modules/catalog/catalog.repository.ts"),
      "utf8",
    );
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/018_pilot_inventory.sql"),
      "utf8",
    );
    expect(repository).toContain("for update of b,s");
    expect(repository).toContain("claimOperation");
    expect(repository).toContain("completeOperation");
    expect(migration).toMatch(
      /unique\s*\(actor_user_id,\s*operation_type,\s*idempotency_key\)/i,
    );
    expect(migration).toContain("inventory_batch_stocks");
  });
});
