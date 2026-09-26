import type { Pool } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import { planFefoAllocation } from "./inventory-policy";

export type CatalogItem = {
  id: string;
  item_code: string;
  item_type: string;
  name: string;
  description: string | null;
  unit: string | null;
  price: string;
  result_setup: unknown;
  track_inventory: boolean;
  supply_group_id: string | null;
  supply_group_name: string | null;
  active: boolean;
  quantity_on_hand: string | null;
  reorder_level: string | null;
  usable_quantity: string | null;
  next_expiry: string | null;
  suggested_order_quantity: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PanelMember = {
  id: string;
  item_code: string;
  name: string;
  item_type: string;
  price: string;
};

export type LabPanel = CatalogItem & { members: PanelMember[] };

export type SupplyUsageRequest = {
  id: string;
  catalog_item_id: string;
  item_code: string;
  item_name: string;
  unit: string | null;
  supply_group_name: string | null;
  location_id: string;
  location_name: string;
  quantity: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  requested_by_name: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  movement_id: string | null;
  quantity_on_hand: string | null;
  created_at: Date;
  updated_at: Date;
};

const SELECT_USAGE_REQUEST = `select r.id,r.catalog_item_id,c.item_code,c.name item_name,c.unit,
  g.name supply_group_name,r.location_id,l.name location_name,r.quantity::text,r.reason,r.status,
  r.requested_by,req.full_name requested_by_name,r.reviewed_by,rev.full_name reviewed_by_name,
  r.reviewed_at,r.review_note,r.movement_id::text,b.quantity_on_hand::text,r.created_at,r.updated_at
  from clinic.supply_usage_requests r
  join clinic.catalog_items c on c.id=r.catalog_item_id
  left join clinic.supply_groups g on g.id=c.supply_group_id
  join clinic.inventory_locations l on l.id=r.location_id
  join clinic.users req on req.id=r.requested_by
  left join clinic.users rev on rev.id=r.reviewed_by
  left join clinic.inventory_balances b on b.catalog_item_id=c.id`;

const SELECT_ITEM = `select c.id,c.item_code,c.item_type,c.name,c.description,c.unit,c.price::text,c.result_setup,
  c.track_inventory,c.supply_group_id,g.name as supply_group_name,c.active,b.quantity_on_hand::text,b.reorder_level::text,
  coalesce((select sum(ib.quantity_remaining) from clinic.inventory_batches ib where ib.catalog_item_id=c.id and ib.quantity_remaining>0 and (ib.expiry_date is null or ib.expiry_date>=current_date)),0)::text usable_quantity,
  (select min(ib.expiry_date) from clinic.inventory_batches ib where ib.catalog_item_id=c.id and ib.quantity_remaining>0 and ib.expiry_date>=current_date)::text next_expiry,
  greatest(0,coalesce(b.reorder_level,0)*2-coalesce((select sum(ib.quantity_remaining) from clinic.inventory_batches ib where ib.catalog_item_id=c.id and ib.quantity_remaining>0 and (ib.expiry_date is null or ib.expiry_date>=current_date)),0))::text suggested_order_quantity,
  c.created_at,c.updated_at
  from clinic.catalog_items c
  left join clinic.inventory_balances b on b.catalog_item_id=c.id
  left join clinic.supply_groups g on g.id=c.supply_group_id`;

export class CatalogRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async list(
    type: string | undefined,
    search: string | undefined,
    includeInactive: boolean,
    limit: number,
  ) {
    const result = await this.pool.query<CatalogItem>(
      `${SELECT_ITEM} where ($1::text is null or c.item_type=$1)
       and ($2::text is null or c.name ilike '%'||$2||'%' or c.item_code ilike '%'||$2||'%')
       and ($3::boolean or c.active=true) order by c.item_type,lower(c.name),c.id limit $4`,
      [type ?? null, search ?? null, includeInactive, limit],
    );
    return result.rows;
  }

  async listPanels(
    includeInactive: boolean,
    limit: number,
  ): Promise<LabPanel[]> {
    const panels = await this.list(
      "lab_panel",
      undefined,
      includeInactive,
      limit,
    );
    if (!panels.length) return [];
    const members = await this.pool.query<PanelMember & { panel_id: string }>(
      `select pm.panel_id,m.id,m.item_code,m.name,m.item_type,m.price::text
       from clinic.catalog_panel_members pm
       join clinic.catalog_items m on m.id=pm.member_item_id
       where pm.panel_id=any($1::uuid[])
       order by pm.panel_id,pm.sort_order,pm.member_item_id`,
      [panels.map((panel) => panel.id)],
    );
    const grouped = new Map<string, PanelMember[]>();
    for (const row of members.rows) {
      const list = grouped.get(row.panel_id) ?? [];
      list.push({
        id: row.id,
        item_code: row.item_code,
        name: row.name,
        item_type: row.item_type,
        price: row.price,
      });
      grouped.set(row.panel_id, list);
    }
    return panels.map((panel) => ({
      ...panel,
      members: grouped.get(panel.id) ?? [],
    }));
  }

  async createLabPanel(
    input: {
      name: string;
      description?: string;
      memberItemIds: string[];
    },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<LabPanel> {
    return withTransaction(this.pool, async (client) => {
      const memberPrice = await this.validatePanelMembers(
        client,
        input.memberItemIds,
      );
      const created = await client.query<{ id: string }>(
        `insert into clinic.catalog_items
          (item_type,name,description,price,track_inventory,created_by,updated_by)
         values ('lab_panel',$1,$2,$3,false,$4,$4) returning id`,
        [input.name, input.description ?? null, memberPrice, actorUserId],
      );
      const panelId = created.rows[0]!.id;
      await this.replacePanelMembers(client, panelId, input.memberItemIds);
      const panel = (await this.findPanelById(panelId, client))!;
      await this.audit.record(
        { ...event, resourceId: panelId, afterData: panel },
        client,
      );
      return panel;
    });
  }

  async create(
    input: {
      itemType: string;
      name: string;
      description?: string;
      unit?: string;
      price: number;
      trackInventory: boolean;
      openingQuantity: number;
      reorderLevel: number;
      supplyGroupId?: string;
      resultSetup?: unknown;
    },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<CatalogItem> {
    return withTransaction(this.pool, async (client) => {
      const created = await client.query<{ id: string }>(
        `insert into clinic.catalog_items
          (item_type,name,description,unit,price,track_inventory,supply_group_id,result_setup,created_by,updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9) returning id`,
        [
          input.itemType,
          input.name,
          input.description ?? null,
          input.unit ?? null,
          input.price,
          input.trackInventory,
          input.supplyGroupId ?? null,
          input.resultSetup ? JSON.stringify(input.resultSetup) : null,
          actorUserId,
        ],
      );
      const itemId = created.rows[0]!.id;
      if (input.trackInventory) {
        await client.query(
          "insert into clinic.inventory_balances (catalog_item_id,quantity_on_hand,reorder_level) values ($1,$2,$3)",
          [itemId, input.openingQuantity, input.reorderLevel],
        );
        if (input.openingQuantity > 0) {
          await client.query(
            `insert into clinic.inventory_movements
              (catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reason,actor_user_id)
             values ($1,'opening',$2,$2,$2,'Opening balance',$3)`,
            [itemId, input.openingQuantity, actorUserId],
          );
          await this.createOpeningBatch(
            client,
            itemId,
            input.itemType,
            input.openingQuantity,
            actorUserId,
          );
        }
      }
      const item = (await this.findById(itemId, client))!;
      await this.audit.record(
        { ...event, resourceId: itemId, afterData: item },
        client,
      );
      return item;
    });
  }

  async listSupplyGroups() {
    const result = await this.pool.query<{
      id: string;
      name: string;
      item_count: string;
    }>(
      `select g.id,g.name,count(c.id)::text item_count
       from clinic.supply_groups g
       left join clinic.catalog_items c on c.supply_group_id=g.id and c.active=true
       group by g.id,g.name
       order by lower(g.name),g.id`,
    );
    return result.rows;
  }

  async createSupplyGroup(
    name: string,
    actorUserId: string,
    event: AuditEventInput,
  ) {
    try {
      const created = await this.pool.query<{ id: string; name: string }>(
        "insert into clinic.supply_groups (name,created_by,updated_by) values ($1,$2,$2) returning id,name",
        [name.trim(), actorUserId],
      );
      const group = created.rows[0]!;
      await this.audit.record({
        ...event,
        resourceId: group.id,
        afterData: group,
      });
      return { ...group, item_count: "0" };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new AppError(
          409,
          "SUPPLY_GROUP_EXISTS",
          "A supply category with this name already exists",
        );
      }
      throw error;
    }
  }

  async createSupplyBundle(
    input: {
      groupId?: string;
      groupName?: string;
      items: Array<{
        name: string;
        unit?: string;
        openingQuantity: number;
        reorderLevel: number;
      }>;
    },
    actorUserId: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const groupId = await this.resolveSupplyGroup(
        client,
        input.groupId,
        input.groupName,
        actorUserId,
      );
      const created: CatalogItem[] = [];
      for (const item of input.items) {
        const inserted = await client.query<{ id: string }>(
          `insert into clinic.catalog_items
            (item_type,name,unit,price,track_inventory,supply_group_id,created_by,updated_by)
           values ('supply',$1,$2,0,true,$3,$4,$4) returning id`,
          [item.name, item.unit ?? null, groupId, actorUserId],
        );
        const itemId = inserted.rows[0]!.id;
        await client.query(
          "insert into clinic.inventory_balances (catalog_item_id,quantity_on_hand,reorder_level) values ($1,$2,$3)",
          [itemId, item.openingQuantity, item.reorderLevel],
        );
        if (item.openingQuantity > 0) {
          await client.query(
            `insert into clinic.inventory_movements
              (catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reason,actor_user_id)
             values ($1,'opening',$2,$2,$2,'Opening balance',$3)`,
            [itemId, item.openingQuantity, actorUserId],
          );
          await this.createOpeningBatch(
            client,
            itemId,
            "supply",
            item.openingQuantity,
            actorUserId,
          );
        }
        created.push((await this.findById(itemId, client))!);
      }
      await this.audit.record(
        {
          ...event,
          resourceId: groupId,
          afterData: { groupId, items: created },
        },
        client,
      );
      return created;
    });
  }

  private async resolveSupplyGroup(
    database: Queryable,
    groupId: string | undefined,
    groupName: string | undefined,
    actorUserId: string,
  ): Promise<string> {
    if (groupId) {
      const existing = await database.query<{ id: string }>(
        "select id from clinic.supply_groups where id=$1",
        [groupId],
      );
      if (!existing.rows[0])
        throw new AppError(
          404,
          "SUPPLY_GROUP_NOT_FOUND",
          "Supply type was not found",
        );
      return existing.rows[0].id;
    }
    const name = groupName?.trim();
    if (!name)
      throw new AppError(
        400,
        "SUPPLY_GROUP_REQUIRED",
        "Create or choose a supply type",
      );
    const found = await database.query<{ id: string }>(
      "select id from clinic.supply_groups where lower(btrim(name))=lower(btrim($1))",
      [name],
    );
    if (found.rows[0]) return found.rows[0].id;
    const created = await database.query<{ id: string }>(
      "insert into clinic.supply_groups (name,created_by,updated_by) values ($1,$2,$2) returning id",
      [name, actorUserId],
    );
    return created.rows[0]!.id;
  }

  async update(
    itemId: string,
    input: {
      name?: string;
      description?: string | null;
      unit?: string | null;
      price?: number;
      active?: boolean;
      reorderLevel?: number;
      memberItemIds?: string[];
      resultSetup?: unknown;
    },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<CatalogItem | LabPanel> {
    return withTransaction(this.pool, async (client) => {
      const before = await this.findById(itemId, client, true);
      if (!before)
        throw new AppError(
          404,
          "CATALOG_ITEM_NOT_FOUND",
          "Catalog item was not found",
        );
      if (before.item_type === "lab_panel") {
        if (
          input.unit !== undefined ||
          input.reorderLevel !== undefined ||
          input.price !== undefined
        ) {
          throw new AppError(
            400,
            "PANEL_PRICE_COMPUTED",
            "Lab panel price is computed from member tests",
          );
        }
        if (input.memberItemIds) {
          const memberPrice = await this.validatePanelMembers(
            client,
            input.memberItemIds,
          );
          await this.replacePanelMembers(client, itemId, input.memberItemIds);
          await client.query(
            "update clinic.catalog_items set price=$2,updated_by=$3,updated_at=now() where id=$1",
            [itemId, memberPrice, actorUserId],
          );
        }
      }
      if (input.resultSetup && before.item_type !== "lab_test" && before.item_type !== "radiology") {
        throw new AppError(
          400,
          "RESULT_SETUP_INVALID",
          "Only lab tests and imaging can have a result setup",
        );
      }
      if (before.item_type !== "lab_panel" && input.memberItemIds) {
        throw new AppError(
          400,
          "PANEL_MEMBERS_INVALID",
          "Only lab panels can have member tests",
        );
      }
      await client.query(
        `update clinic.catalog_items set name=coalesce($2,name),
          description=case when $3::boolean then $4 else description end,
          unit=case when $5::boolean then $6 else unit end,
          price=coalesce($7,price),active=coalesce($8,active),updated_by=$9,updated_at=now(),
          result_setup=case when $10::boolean then $11::jsonb else result_setup end
         where id=$1`,
        [
          itemId,
          input.name ?? null,
          "description" in input,
          input.description ?? null,
          "unit" in input,
          input.unit ?? null,
          input.price ?? null,
          input.active ?? null,
          actorUserId,
          "resultSetup" in input,
          input.resultSetup ? JSON.stringify(input.resultSetup) : null,
        ],
      );
      if (input.reorderLevel !== undefined) {
        const updated = await client.query(
          "update clinic.inventory_balances set reorder_level=$2,updated_at=now() where catalog_item_id=$1",
          [itemId, input.reorderLevel],
        );
        if (!updated.rowCount)
          throw new AppError(
            409,
            "INVENTORY_NOT_TRACKED",
            "This item does not track inventory",
          );
      }
      const after =
        before.item_type === "lab_panel"
          ? (await this.findPanelById(itemId, client))!
          : (await this.findById(itemId, client))!;
      await this.audit.record(
        { ...event, resourceId: itemId, beforeData: before, afterData: after },
        client,
      );
      return after;
    });
  }

  static async expandDiagnosticCatalogIds(
    database: Queryable,
    ids: string[],
  ): Promise<string[]> {
    const expanded: string[] = [];
    for (const id of ids) {
      const item = await database.query<{ item_type: string }>(
        "select item_type from clinic.catalog_items where id=$1 and active=true",
        [id],
      );
      const row = item.rows[0];
      if (!row) {
        expanded.push(id);
        continue;
      }
      if (row.item_type === "lab_panel") {
        const members = await database.query<{ member_item_id: string }>(
          "select member_item_id from clinic.catalog_panel_members where panel_id=$1 order by sort_order,member_item_id",
          [id],
        );
        if (!members.rowCount)
          throw new AppError(
            400,
            "PANEL_EMPTY",
            "Lab panel has no active member tests",
          );
        expanded.push(...members.rows.map((member) => member.member_item_id));
      } else {
        expanded.push(id);
      }
    }
    return [...new Set(expanded)];
  }

  async adjustInventory(
    itemId: string,
    delta: number,
    reason: string,
    actorUserId: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const balance = await client.query<{
        quantity_on_hand: string;
        item_type: string;
      }>(
        "select b.quantity_on_hand::text,c.item_type from clinic.inventory_balances b join clinic.catalog_items c on c.id=b.catalog_item_id where b.catalog_item_id=$1 for update of b",
        [itemId],
      );
      if (!balance.rows[0])
        throw new AppError(
          409,
          "INVENTORY_NOT_TRACKED",
          "This item does not track inventory",
        );
      const next = Number(balance.rows[0].quantity_on_hand) + delta;
      if (next < 0)
        throw new AppError(
          409,
          "INSUFFICIENT_STOCK",
          "Inventory adjustment would create negative stock",
        );
      if (delta < 0) {
        let toRemove = -delta;
        const batches = await client.query<{
          id: string;
          quantity_remaining: string;
          location_id: string;
        }>(
          `select b.id,s.quantity::text quantity_remaining,s.location_id from clinic.inventory_batches b join clinic.inventory_batch_stocks s on s.inventory_batch_id=b.id where b.catalog_item_id=$1 and s.quantity>0 order by (b.expiry_date<current_date) desc,b.expiry_date asc nulls last,b.received_at,b.id for update of b,s`,
          [itemId],
        );
        for (const batch of batches.rows) {
          if (toRemove <= 0) break;
          const removed = Math.min(toRemove, Number(batch.quantity_remaining));
          await client.query(
            "update clinic.inventory_batches set quantity_remaining=quantity_remaining-$2 where id=$1",
            [batch.id, removed],
          );
          await client.query(
            "update clinic.inventory_batch_stocks set quantity=quantity-$3,updated_at=now() where inventory_batch_id=$1 and location_id=$2",
            [batch.id, batch.location_id, removed],
          );
          toRemove -= removed;
        }
      }
      if (delta > 0)
        await this.createOpeningBatch(
          client,
          itemId,
          balance.rows[0].item_type,
          delta,
          actorUserId,
        );
      await client.query(
        "update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",
        [itemId, next],
      );
      await client.query(
        `insert into clinic.inventory_movements
          (catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reason,actor_user_id)
         values ($1,$2,$3,abs($3),$4,$5,$6)`,
        [
          itemId,
          delta > 0 ? "adjustment_in" : "adjustment_out",
          delta,
          next,
          reason,
          actorUserId,
        ],
      );
      const item = (await this.findById(itemId, client))!;
      await this.audit.record(
        {
          ...event,
          resourceId: itemId,
          beforeData: { quantityOnHand: balance.rows[0].quantity_on_hand },
          afterData: { quantityOnHand: item.quantity_on_hand, reason },
        },
        client,
      );
      return item;
    });
  }

  async consumeInventory(
    itemId: string,
    quantity: number,
    reason: string,
    locationId: string,
    actorUserId: string,
    event: AuditEventInput,
    idempotencyKey?: string,
    reference?: { type: string; id: string },
  ) {
    return withTransaction(this.pool, async (client) => {
      const operation = await this.claimOperation(
        client,
        actorUserId,
        "consume",
        idempotencyKey,
      );
      if (operation.replay) return operation.replay;
      const after = await this.applyConsume(
        client,
        itemId,
        quantity,
        reason,
        locationId,
        actorUserId,
        event,
        reference,
      );
      await this.completeOperation(client, operation.id, after.item);
      return after.item;
    });
  }

  async createSupplyUsageRequest(
    input: {
      catalogItemId: string;
      quantity: number;
      reason: string;
      locationId?: string;
    },
    actorUserId: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const item = await this.findById(input.catalogItemId, client);
      if (!item)
        throw new AppError(
          404,
          "CATALOG_ITEM_NOT_FOUND",
          "Catalog item was not found",
        );
      if (item.item_type !== "supply")
        throw new AppError(
          409,
          "NOT_A_SUPPLY",
          "Only clinic supplies can be requested for usage",
        );
      const location = input.locationId
        ? await client.query<{ id: string }>(
            "select id from clinic.inventory_locations where id=$1 and active=true",
            [input.locationId],
          )
        : await client.query<{ id: string }>(
            "select id from clinic.inventory_locations where code='main_store' and active=true",
          );
      if (!location.rows[0])
        throw new AppError(
          404,
          "INVENTORY_LOCATION_NOT_FOUND",
          "Inventory location was not found",
        );
      const created = await client.query<{ id: string }>(
        `insert into clinic.supply_usage_requests
          (catalog_item_id,location_id,quantity,reason,requested_by)
         values ($1,$2,$3,$4,$5) returning id`,
        [
          input.catalogItemId,
          location.rows[0].id,
          input.quantity,
          input.reason,
          actorUserId,
        ],
      );
      const request = await this.findSupplyUsageRequest(
        created.rows[0]!.id,
        client,
      );
      await this.audit.record(
        {
          ...event,
          resourceId: request!.id,
          afterData: { request },
        },
        client,
      );
      return request!;
    });
  }

  async listSupplyUsageRequests(input: {
    status?: "pending" | "approved" | "rejected";
    requestedBy?: string;
    limit: number;
  }) {
    const result = await this.pool.query(
      `${SELECT_USAGE_REQUEST}
       where ($1::text is null or r.status=$1)
         and ($2::uuid is null or r.requested_by=$2)
       order by
         case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
         r.created_at desc, r.id desc
       limit $3`,
      [input.status ?? null, input.requestedBy ?? null, input.limit],
    );
    return result.rows;
  }

  async approveSupplyUsageRequest(
    requestId: string,
    actorUserId: string,
    reviewNote: string | undefined,
    event: AuditEventInput,
    idempotencyKey?: string,
  ) {
    return withTransaction(this.pool, async (client) => {
      const operation = await this.claimOperation(
        client,
        actorUserId,
        "usage_approve",
        idempotencyKey,
      );
      if (operation.replay) return operation.replay;
      const locked = await client.query<{
        id: string;
        catalog_item_id: string;
        location_id: string;
        quantity: string;
        reason: string;
        status: string;
      }>(
        `select id,catalog_item_id,location_id,quantity::text,reason,status
         from clinic.supply_usage_requests where id=$1 for update`,
        [requestId],
      );
      const row = locked.rows[0];
      if (!row)
        throw new AppError(
          404,
          "USAGE_REQUEST_NOT_FOUND",
          "Usage request was not found",
        );
      if (row.status !== "pending")
        throw new AppError(
          409,
          "USAGE_REQUEST_NOT_PENDING",
          "Only pending usage requests can be approved",
        );
      const reason = reviewNote?.trim()
        ? `${row.reason} · Admin: ${reviewNote.trim()}`
        : row.reason;
      const consumed = await this.applyConsume(
        client,
        row.catalog_item_id,
        Number(row.quantity),
        reason,
        row.location_id,
        actorUserId,
        {
          ...event,
          action: "inventory.consumed",
          resourceType: "catalog_item",
        },
        { type: "supply_usage_request", id: row.id },
      );
      await client.query(
        `update clinic.supply_usage_requests
         set status='approved', reviewed_by=$2, reviewed_at=now(),
             review_note=$3, movement_id=$4, updated_at=now()
         where id=$1`,
        [
          row.id,
          actorUserId,
          reviewNote?.trim() || null,
          consumed.movementId,
        ],
      );
      const request = await this.findSupplyUsageRequest(row.id, client);
      await this.audit.record(
        {
          ...event,
          resourceId: row.id,
          afterData: { request, item: consumed.item },
        },
        client,
      );
      await this.completeOperation(client, operation.id, request);
      return request!;
    });
  }

  async rejectSupplyUsageRequest(
    requestId: string,
    actorUserId: string,
    reviewNote: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const locked = await client.query<{ id: string; status: string }>(
        "select id,status from clinic.supply_usage_requests where id=$1 for update",
        [requestId],
      );
      const row = locked.rows[0];
      if (!row)
        throw new AppError(
          404,
          "USAGE_REQUEST_NOT_FOUND",
          "Usage request was not found",
        );
      if (row.status !== "pending")
        throw new AppError(
          409,
          "USAGE_REQUEST_NOT_PENDING",
          "Only pending usage requests can be rejected",
        );
      await client.query(
        `update clinic.supply_usage_requests
         set status='rejected', reviewed_by=$2, reviewed_at=now(),
             review_note=$3, updated_at=now()
         where id=$1`,
        [row.id, actorUserId, reviewNote],
      );
      const request = await this.findSupplyUsageRequest(row.id, client);
      await this.audit.record(
        {
          ...event,
          resourceId: row.id,
          afterData: { request },
        },
        client,
      );
      return request!;
    });
  }

  async receiveBatch(
    itemId: string,
    input: {
      batchNumber: string;
      supplierName: string;
      purchaseReference?: string;
      quantity: number;
      expiryDate?: string;
      unitCost?: number;
      locationId?: string;
      packQuantity?: number;
      unitsPerPack?: number;
      idempotencyKey?: string;
    },
    actorUserId: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const operation = await this.claimOperation(
        client,
        actorUserId,
        "receipt",
        input.idempotencyKey,
      );
      if (operation.replay) return operation.replay;
      const item = await this.findById(itemId, client, true);
      if (!item)
        throw new AppError(
          404,
          "CATALOG_ITEM_NOT_FOUND",
          "Catalog item was not found",
        );
      if (!item.track_inventory)
        throw new AppError(
          409,
          "INVENTORY_NOT_TRACKED",
          "This item does not track inventory",
        );
      const location = input.locationId
        ? await client.query<{ id: string }>(
            "select id from clinic.inventory_locations where id=$1 and active=true",
            [input.locationId],
          )
        : await client.query<{ id: string }>(
            "select id from clinic.inventory_locations where code=$1",
            [item.item_type === "drug" ? "pharmacy" : "main_store"],
          );
      if (!location.rows[0])
        throw new AppError(
          404,
          "INVENTORY_LOCATION_NOT_FOUND",
          "Inventory location was not found",
        );
      const balance = await client.query<{ quantity_on_hand: string }>(
        "select quantity_on_hand::text from clinic.inventory_balances where catalog_item_id=$1 for update",
        [itemId],
      );
      if (!balance.rows[0])
        throw new AppError(
          409,
          "INVENTORY_BALANCE_MISSING",
          "Tracked item has no inventory balance",
        );
      const created = await client.query<{ id: string }>(
        `insert into clinic.inventory_batches(catalog_item_id,batch_number,supplier_name,purchase_reference,received_quantity,quantity_remaining,expiry_date,unit_cost,received_by,pack_quantity,units_per_pack)
         values($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10) returning id`,
        [
          itemId,
          input.batchNumber,
          input.supplierName,
          input.purchaseReference ?? null,
          input.quantity,
          input.expiryDate ?? null,
          input.unitCost ?? null,
          actorUserId,
          input.packQuantity ?? null,
          input.unitsPerPack ?? 1,
        ],
      );
      await client.query(
        "insert into clinic.inventory_batch_stocks(inventory_batch_id,location_id,quantity) values($1,$2,$3)",
        [created.rows[0]!.id, location.rows[0]!.id, input.quantity],
      );
      const next = Number(balance.rows[0].quantity_on_hand) + input.quantity;
      await client.query(
        "update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",
        [itemId, next],
      );
      const movement = await client.query<{ id: string }>(
        `insert into clinic.inventory_movements(catalog_item_id,batch_id,movement_type,quantity_delta,movement_quantity,balance_after,reference_type,reference_id,reason,actor_user_id,destination_location_id,transaction_reference)
         values($1,$2::uuid,'receipt',$3,$3,$4,'inventory_batch',$9,$5,$6,$7,$8) returning id`,
        [
          itemId,
          created.rows[0]!.id,
          input.quantity,
          next,
          input.purchaseReference ?? input.supplierName,
          actorUserId,
          location.rows[0]!.id,
          input.purchaseReference ?? null,
          String(created.rows[0]!.id),
        ],
      );
      await client.query(
        "insert into clinic.inventory_movement_batches(movement_id,inventory_batch_id,quantity) values($1,$2,$3)",
        [movement.rows[0]!.id, created.rows[0]!.id, input.quantity],
      );
      const batch = (
        await client.query(
          `select b.id,b.catalog_item_id,c.item_code,c.name item_name,c.unit,b.batch_number,b.supplier_name,b.purchase_reference,b.received_quantity::text,b.quantity_remaining::text,b.expiry_date,b.unit_cost::text,b.received_by,u.full_name received_by_name,b.received_at,(b.expiry_date is not null and b.expiry_date<current_date) expired from clinic.inventory_batches b join clinic.catalog_items c on c.id=b.catalog_item_id join clinic.users u on u.id=b.received_by where b.id=$1`,
          [created.rows[0]!.id],
        )
      ).rows[0];
      await this.audit.record(
        { ...event, resourceId: created.rows[0]!.id, afterData: batch },
        client,
      );
      await this.completeOperation(client, operation.id, batch);
      return batch;
    });
  }

  async listInventoryBatches(
    limit: number,
    itemId?: string,
    itemType?: string,
  ) {
    const result = await this.pool.query(
      `select b.id,b.catalog_item_id,c.item_code,c.name item_name,c.unit,c.item_type,b.batch_number,b.supplier_name,b.purchase_reference,
        b.received_quantity::text,b.quantity_remaining::text,b.expiry_date,b.unit_cost::text,b.pack_quantity::text,b.units_per_pack::text,b.received_by,u.full_name received_by_name,b.received_at,
        (b.expiry_date is not null and b.expiry_date<current_date) expired,
        case when b.expiry_date is null then null else b.expiry_date-current_date end days_to_expiry,
        coalesce((select jsonb_agg(jsonb_build_object('location_id',l.id,'location_name',l.name,'quantity',s.quantity::text) order by l.name) from clinic.inventory_batch_stocks s join clinic.inventory_locations l on l.id=s.location_id where s.inventory_batch_id=b.id and s.quantity>0),'[]'::jsonb) locations
       from clinic.inventory_batches b join clinic.catalog_items c on c.id=b.catalog_item_id join clinic.users u on u.id=b.received_by
       where ($1::uuid is null or b.catalog_item_id=$1)
         and ($3::text is null or c.item_type=$3)
       order by b.expiry_date asc nulls last,b.received_at desc,b.id limit $2`,
      [itemId ?? null, limit, itemType ?? null],
    );
    return result.rows;
  }

  async listInventoryMovements(
    limit: number,
    itemId?: string,
    itemType?: string,
  ) {
    const result = await this.pool.query(
      `select m.id,m.catalog_item_id,c.item_code,c.name item_name,c.unit,c.item_type,m.movement_type,
        m.quantity_delta::text,m.movement_quantity::text,m.balance_after::text,m.reason,m.reference_type,m.reference_id,m.transaction_reference,
        m.source_location_id,sl.name source_location_name,m.destination_location_id,dl.name destination_location_name,
        m.actor_user_id,u.full_name actor_name,m.occurred_at
       from clinic.inventory_movements m
       join clinic.catalog_items c on c.id=m.catalog_item_id
       join clinic.users u on u.id=m.actor_user_id
       left join clinic.inventory_locations sl on sl.id=m.source_location_id
       left join clinic.inventory_locations dl on dl.id=m.destination_location_id
       where ($1::uuid is null or m.catalog_item_id=$1)
         and ($3::text is null or c.item_type=$3)
       order by m.occurred_at desc,m.id desc limit $2`,
      [itemId ?? null, limit, itemType ?? null],
    );
    return result.rows;
  }

  async listInventoryLocations() {
    const result = await this.pool.query(
      "select id,code,name,active from clinic.inventory_locations where active=true order by case code when 'main_store' then 0 when 'pharmacy' then 1 else 2 end,name",
    );
    return result.rows;
  }

  async listLocationStock(itemType?: string) {
    const result = await this.pool.query(
      `select c.id catalog_item_id,c.item_code,c.name item_name,c.item_type,c.unit,c.supply_group_id,g.name supply_group_name,
      l.id location_id,l.name location_name,
      coalesce(sum(s.quantity),0)::text quantity_on_hand,
      coalesce(sum(s.quantity) filter(where b.expiry_date is null or b.expiry_date>=current_date),0)::text usable_quantity,
      ib.reorder_level::text,
      greatest(0,ib.reorder_level*2-coalesce(sum(s.quantity) filter(where b.expiry_date is null or b.expiry_date>=current_date),0))::text suggested_order_quantity,
      min(b.expiry_date) filter(where s.quantity>0 and b.expiry_date>=current_date)::text next_expiry,
      (select max(sc.counted_at) from clinic.inventory_stock_counts sc where sc.catalog_item_id=c.id and sc.location_id=l.id) last_counted_at
      from clinic.catalog_items c
      join clinic.inventory_balances ib on ib.catalog_item_id=c.id
      join clinic.inventory_batches b on b.catalog_item_id=c.id
      join clinic.inventory_batch_stocks s on s.inventory_batch_id=b.id
      join clinic.inventory_locations l on l.id=s.location_id
      left join clinic.supply_groups g on g.id=c.supply_group_id
      where c.active=true and c.track_inventory and ($1::text is null or c.item_type=$1)
      group by c.id,c.item_code,c.name,c.item_type,c.unit,c.supply_group_id,g.name,l.id,l.name,ib.reorder_level
      order by c.item_type,lower(c.name),l.name`,
      [itemType ?? null],
    );
    return result.rows;
  }

  async transferInventory(
    itemId: string,
    input: {
      sourceLocationId: string;
      destinationLocationId: string;
      quantity: number;
      reason: string;
      reference?: string;
      idempotencyKey?: string;
    },
    actorUserId: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const operation = await this.claimOperation(
        client,
        actorUserId,
        "transfer",
        input.idempotencyKey,
      );
      if (operation.replay) return operation.replay;
      if (input.sourceLocationId === input.destinationLocationId)
        throw new AppError(
          400,
          "INVENTORY_LOCATION_SAME",
          "Choose two different locations",
        );
      const item = await this.findById(itemId, client, true);
      if (!item?.track_inventory)
        throw new AppError(
          409,
          "INVENTORY_NOT_TRACKED",
          "This item does not track inventory",
        );
      const batches = await client.query<{ id: string; quantity: string }>(
        `select b.id,s.quantity::text from clinic.inventory_batches b join clinic.inventory_batch_stocks s on s.inventory_batch_id=b.id
        where b.catalog_item_id=$1 and s.location_id=$2 and s.quantity>0 and (b.expiry_date is null or b.expiry_date>=current_date)
        order by b.expiry_date asc nulls last,b.received_at,b.id for update of b,s`,
        [itemId, input.sourceLocationId],
      );
      const available = batches.rows.reduce(
        (sum, row) => sum + Number(row.quantity),
        0,
      );
      if (input.quantity > available)
        throw new AppError(
          409,
          "INSUFFICIENT_USABLE_STOCK",
          `Only ${available} non-expired units are available at the source location`,
        );
      let remaining = input.quantity;
      const allocations: Array<{ id: string; quantity: number }> = [];
      for (const batch of batches.rows) {
        if (remaining <= 0) break;
        const quantity = Math.min(remaining, Number(batch.quantity));
        await client.query(
          "update clinic.inventory_batch_stocks set quantity=quantity-$3,updated_at=now() where inventory_batch_id=$1 and location_id=$2",
          [batch.id, input.sourceLocationId, quantity],
        );
        await client.query(
          `insert into clinic.inventory_batch_stocks(inventory_batch_id,location_id,quantity) values($1,$2,$3) on conflict(inventory_batch_id,location_id) do update set quantity=clinic.inventory_batch_stocks.quantity+excluded.quantity,updated_at=now()`,
          [batch.id, input.destinationLocationId, quantity],
        );
        allocations.push({ id: batch.id, quantity });
        remaining -= quantity;
      }
      const movement = await client.query<{ id: string }>(
        `insert into clinic.inventory_movements(catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reason,actor_user_id,source_location_id,destination_location_id,transaction_reference)
        values($1,'transfer',0,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          itemId,
          input.quantity,
          Number(item.quantity_on_hand ?? 0),
          input.reason,
          actorUserId,
          input.sourceLocationId,
          input.destinationLocationId,
          input.reference ?? null,
        ],
      );
      for (const allocation of allocations)
        await client.query(
          "insert into clinic.inventory_movement_batches(movement_id,inventory_batch_id,quantity) values($1,$2,$3)",
          [movement.rows[0]!.id, allocation.id, allocation.quantity],
        );
      const result = {
        itemId,
        quantity: input.quantity,
        sourceLocationId: input.sourceLocationId,
        destinationLocationId: input.destinationLocationId,
      };
      await this.audit.record(
        { ...event, resourceId: itemId, afterData: result },
        client,
      );
      await this.completeOperation(client, operation.id, result);
      return result;
    });
  }

  async countInventory(
    itemId: string,
    input: {
      locationId: string;
      countedQuantity: number;
      reason: string;
      reference?: string;
      idempotencyKey?: string;
    },
    actorUserId: string,
    event: AuditEventInput,
  ) {
    return withTransaction(this.pool, async (client) => {
      const operation = await this.claimOperation(
        client,
        actorUserId,
        "stock_count",
        input.idempotencyKey,
      );
      if (operation.replay) return operation.replay;
      const item = await this.findById(itemId, client, true);
      if (!item?.track_inventory)
        throw new AppError(
          409,
          "INVENTORY_NOT_TRACKED",
          "This item does not track inventory",
        );
      const stocks = await client.query<{ id: string; quantity: string }>(
        `select b.id,s.quantity::text from clinic.inventory_batches b join clinic.inventory_batch_stocks s on s.inventory_batch_id=b.id where b.catalog_item_id=$1 and s.location_id=$2 and s.quantity>0 order by (b.expiry_date<current_date) desc,b.expiry_date asc nulls last,b.received_at,b.id for update of b,s`,
        [itemId, input.locationId],
      );
      const system = stocks.rows.reduce(
        (sum, row) => sum + Number(row.quantity),
        0,
      );
      const variance = input.countedQuantity - system;
      if (variance < 0) {
        let remaining = -variance;
        for (const stock of stocks.rows) {
          if (remaining <= 0) break;
          const quantity = Math.min(remaining, Number(stock.quantity));
          await client.query(
            "update clinic.inventory_batch_stocks set quantity=quantity-$3,updated_at=now() where inventory_batch_id=$1 and location_id=$2",
            [stock.id, input.locationId, quantity],
          );
          await client.query(
            "update clinic.inventory_batches set quantity_remaining=quantity_remaining-$2 where id=$1",
            [stock.id, quantity],
          );
          remaining -= quantity;
        }
      }
      if (variance > 0) {
        const batch = await client.query<{ id: string }>(
          `insert into clinic.inventory_batches(catalog_item_id,batch_number,supplier_name,purchase_reference,received_quantity,quantity_remaining,received_by) values($1,'COUNT-ADJUSTMENT','Physical count',$2,$3,$3,$4) on conflict(catalog_item_id,batch_number) do update set received_quantity=clinic.inventory_batches.received_quantity+excluded.received_quantity,quantity_remaining=clinic.inventory_batches.quantity_remaining+excluded.quantity_remaining returning id`,
          [
            itemId,
            input.reference ?? "Count adjustment",
            variance,
            actorUserId,
          ],
        );
        await client.query(
          `insert into clinic.inventory_batch_stocks(inventory_batch_id,location_id,quantity) values($1,$2,$3) on conflict(inventory_batch_id,location_id) do update set quantity=clinic.inventory_batch_stocks.quantity+excluded.quantity,updated_at=now()`,
          [batch.rows[0]!.id, input.locationId, variance],
        );
      }
      if (variance !== 0) {
        const total = Number(item.quantity_on_hand ?? 0) + variance;
        await client.query(
          "update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",
          [itemId, total],
        );
        await client.query(
          `insert into clinic.inventory_movements(catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reason,actor_user_id,source_location_id,transaction_reference) values($1,'stock_count',$2,abs($2),$3,$4,$5,$6,$7)`,
          [
            itemId,
            variance,
            total,
            input.reason,
            actorUserId,
            input.locationId,
            input.reference ?? null,
          ],
        );
      }
      const count = (
        await client.query(
          `insert into clinic.inventory_stock_counts(catalog_item_id,location_id,system_quantity,counted_quantity,variance,reason,counted_by) values($1,$2,$3,$4,$5,$6,$7) returning *`,
          [
            itemId,
            input.locationId,
            system,
            input.countedQuantity,
            variance,
            input.reason,
            actorUserId,
          ],
        )
      ).rows[0];
      await this.audit.record(
        { ...event, resourceId: count.id, afterData: count },
        client,
      );
      await this.completeOperation(client, operation.id, count);
      return count;
    });
  }

  private async applyConsume(
    client: Queryable,
    itemId: string,
    quantity: number,
    reason: string,
    locationId: string,
    actorUserId: string,
    event: AuditEventInput,
    reference?: { type: string; id: string },
  ) {
    const item = await this.findById(itemId, client, true);
    if (!item)
      throw new AppError(
        404,
        "CATALOG_ITEM_NOT_FOUND",
        "Catalog item was not found",
      );
    if (item.item_type !== "supply") {
      throw new AppError(
        409,
        "NOT_A_SUPPLY",
        "Only clinic supplies can be consumed from this action",
      );
    }
    const balance = await client.query<{ quantity_on_hand: string }>(
      "select quantity_on_hand::text from clinic.inventory_balances where catalog_item_id=$1 for update",
      [itemId],
    );
    if (!balance.rows[0])
      throw new AppError(
        409,
        "INVENTORY_NOT_TRACKED",
        "This item does not track inventory",
      );
    const next = Number(balance.rows[0].quantity_on_hand) - quantity;
    if (next < 0)
      throw new AppError(
        409,
        "INSUFFICIENT_STOCK",
        "Not enough stock to record this usage",
      );
    const batches = await client.query<{
      id: string;
      quantity_remaining: string;
      location_id: string;
      expiry_date: string | null;
    }>(
      `select b.id,s.quantity::text quantity_remaining,s.location_id,b.expiry_date::text
       from clinic.inventory_batches b
       join clinic.inventory_batch_stocks s on s.inventory_batch_id=b.id
       where b.catalog_item_id=$1 and s.location_id=$2 and s.quantity>0
       order by b.expiry_date asc nulls last,b.received_at,b.id for update of b,s`,
      [itemId, locationId],
    );
    const planned = planFefoAllocation(
      batches.rows.map((batch) => ({
        id: batch.id,
        quantity: Number(batch.quantity_remaining),
        expiryDate: batch.expiry_date,
        locationId: batch.location_id,
      })),
      quantity,
    );
    const allocations: Array<{
      id: string;
      quantity: number;
      locationId: string;
    }> = [];
    for (const batch of planned) {
      const removed = batch.allocated;
      await client.query(
        "update clinic.inventory_batches set quantity_remaining=quantity_remaining-$2 where id=$1",
        [batch.id, removed],
      );
      await client.query(
        "update clinic.inventory_batch_stocks set quantity=quantity-$3,updated_at=now() where inventory_batch_id=$1 and location_id=$2",
        [batch.id, batch.locationId, removed],
      );
      allocations.push({
        id: batch.id,
        quantity: removed,
        locationId: batch.locationId,
      });
    }
    await client.query(
      "update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",
      [itemId, next],
    );
    const movement = await client.query<{ id: string }>(
      `insert into clinic.inventory_movements
        (catalog_item_id,movement_type,quantity_delta,movement_quantity,balance_after,reason,actor_user_id,source_location_id,reference_type,reference_id)
       values ($1,'consume',$2,$6,$3,$4,$5,$7,$8,$9) returning id`,
      [
        itemId,
        -quantity,
        next,
        reason,
        actorUserId,
        quantity,
        locationId,
        reference?.type ?? null,
        reference?.id ?? null,
      ],
    );
    for (const allocation of allocations)
      await client.query(
        "insert into clinic.inventory_movement_batches(movement_id,inventory_batch_id,quantity) values($1,$2,$3)",
        [movement.rows[0]!.id, allocation.id, allocation.quantity],
      );
    const after = (await this.findById(itemId, client))!;
    await this.audit.record(
      {
        ...event,
        resourceId: itemId,
        beforeData: { quantityOnHand: balance.rows[0].quantity_on_hand },
        afterData: { quantityOnHand: after.quantity_on_hand, reason },
      },
      client,
    );
    return { item: after, movementId: movement.rows[0]!.id };
  }

  private async findSupplyUsageRequest(
    id: string,
    database: Queryable,
  ): Promise<SupplyUsageRequest | null> {
    const result = await database.query<SupplyUsageRequest>(
      `${SELECT_USAGE_REQUEST} where r.id=$1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  private async findById(
    itemId: string,
    database: Queryable,
    lock = false,
  ): Promise<CatalogItem | null> {
    const result = await database.query<CatalogItem>(
      `${SELECT_ITEM} where c.id=$1 ${lock ? "for update of c" : ""}`,
      [itemId],
    );
    return result.rows[0] ?? null;
  }

  private async createOpeningBatch(
    database: Queryable,
    itemId: string,
    itemType: string,
    quantity: number,
    actorUserId: string,
  ) {
    const locationCode = itemType === "drug" ? "pharmacy" : "main_store";
    const location = await database.query<{ id: string }>(
      "select id from clinic.inventory_locations where code=$1",
      [locationCode],
    );
    const batch = await database.query<{ id: string }>(
      `insert into clinic.inventory_batches(catalog_item_id,batch_number,supplier_name,purchase_reference,received_quantity,quantity_remaining,received_by)
       values($1,'OPENING-STOCK','Opening balance','Item creation',$2,$2,$3)
       on conflict(catalog_item_id,batch_number) do update set received_quantity=clinic.inventory_batches.received_quantity+excluded.received_quantity,quantity_remaining=clinic.inventory_batches.quantity_remaining+excluded.quantity_remaining
       returning id`,
      [itemId, quantity, actorUserId],
    );
    await database.query(
      `insert into clinic.inventory_batch_stocks(inventory_batch_id,location_id,quantity) values($1,$2,$3)
       on conflict(inventory_batch_id,location_id) do update set quantity=clinic.inventory_batch_stocks.quantity+excluded.quantity,updated_at=now()`,
      [batch.rows[0]!.id, location.rows[0]!.id, quantity],
    );
  }

  private async claimOperation(
    database: Queryable,
    actorUserId: string,
    type: string,
    key?: string,
  ): Promise<{ id: string | null; replay: any | null }> {
    if (!key) return { id: null, replay: null };
    const created = await database.query<{ id: string }>(
      `insert into clinic.inventory_operations(actor_user_id,operation_type,idempotency_key) values($1,$2,$3) on conflict do nothing returning id`,
      [actorUserId, type, key],
    );
    if (created.rows[0]) return { id: created.rows[0].id, replay: null };
    const existing = await database.query<{ response_data: any }>(
      "select response_data from clinic.inventory_operations where actor_user_id=$1 and operation_type=$2 and idempotency_key=$3 for update",
      [actorUserId, type, key],
    );
    if (existing.rows[0]?.response_data)
      return { id: null, replay: existing.rows[0].response_data };
    throw new AppError(
      409,
      "INVENTORY_OPERATION_IN_PROGRESS",
      "This inventory operation is already being processed",
    );
  }

  private async completeOperation(
    database: Queryable,
    id: string | null,
    response: unknown,
  ) {
    if (id)
      await database.query(
        "update clinic.inventory_operations set response_data=$2,completed_at=now() where id=$1",
        [id, response],
      );
  }

  private async findPanelById(
    panelId: string,
    database: Queryable,
  ): Promise<LabPanel | null> {
    const panel = await this.findById(panelId, database);
    if (!panel) return null;
    const members = await database.query<PanelMember>(
      `select m.id,m.item_code,m.name,m.item_type,m.price::text
       from clinic.catalog_panel_members pm
       join clinic.catalog_items m on m.id=pm.member_item_id
       where pm.panel_id=$1
       order by pm.sort_order,pm.member_item_id`,
      [panelId],
    );
    return { ...panel, members: members.rows };
  }

  private async validatePanelMembers(
    database: Queryable,
    memberItemIds: string[],
  ): Promise<number> {
    const members = await database.query<{ price: string }>(
      `select price::text from clinic.catalog_items
       where id=any($1::uuid[]) and active=true and item_type in ('lab_test','radiology')`,
      [memberItemIds],
    );
    if (members.rowCount !== memberItemIds.length) {
      throw new AppError(
        400,
        "PANEL_MEMBER_INVALID",
        "One or more panel member tests are invalid",
      );
    }
    return members.rows.reduce((sum, member) => sum + Number(member.price), 0);
  }

  private async replacePanelMembers(
    database: Queryable,
    panelId: string,
    memberItemIds: string[],
  ): Promise<void> {
    await database.query(
      "delete from clinic.catalog_panel_members where panel_id=$1",
      [panelId],
    );
    for (let index = 0; index < memberItemIds.length; index += 1) {
      await database.query(
        "insert into clinic.catalog_panel_members (panel_id,member_item_id,sort_order) values ($1,$2,$3)",
        [panelId, memberItemIds[index], index],
      );
    }
  }
}
