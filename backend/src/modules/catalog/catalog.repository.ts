import type { Pool } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";

export type CatalogItem = {
  id: string;
  item_code: string;
  item_type: string;
  name: string;
  description: string | null;
  unit: string | null;
  price: string;
  track_inventory: boolean;
  active: boolean;
  quantity_on_hand: string | null;
  reorder_level: string | null;
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

const SELECT_ITEM = `select c.id,c.item_code,c.item_type,c.name,c.description,c.unit,c.price::text,
  c.track_inventory,c.active,b.quantity_on_hand::text,b.reorder_level::text,c.created_at,c.updated_at
  from clinic.catalog_items c left join clinic.inventory_balances b on b.catalog_item_id=c.id`;

export class CatalogRepository {
  constructor(private readonly pool: Pool, private readonly audit: AuditRepository) {}

  async list(type: string | undefined, search: string | undefined, includeInactive: boolean, limit: number) {
    const result = await this.pool.query<CatalogItem>(
      `${SELECT_ITEM} where ($1::text is null or c.item_type=$1)
       and ($2::text is null or c.name ilike '%'||$2||'%' or c.item_code ilike '%'||$2||'%')
       and ($3::boolean or c.active=true) order by c.item_type,lower(c.name),c.id limit $4`,
      [type ?? null, search ?? null, includeInactive, limit],
    );
    return result.rows;
  }

  async listPanels(includeInactive: boolean, limit: number): Promise<LabPanel[]> {
    const panels = await this.list("lab_panel", undefined, includeInactive, limit);
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
      list.push({ id: row.id, item_code: row.item_code, name: row.name, item_type: row.item_type, price: row.price });
      grouped.set(row.panel_id, list);
    }
    return panels.map((panel) => ({ ...panel, members: grouped.get(panel.id) ?? [] }));
  }

  async createLabPanel(input: {
    name: string; description?: string; memberItemIds: string[];
  }, actorUserId: string, event: AuditEventInput): Promise<LabPanel> {
    return withTransaction(this.pool, async (client) => {
      const memberPrice = await this.validatePanelMembers(client, input.memberItemIds);
      const created = await client.query<{ id: string }>(
        `insert into clinic.catalog_items
          (item_type,name,description,price,track_inventory,created_by,updated_by)
         values ('lab_panel',$1,$2,$3,false,$4,$4) returning id`,
        [input.name, input.description ?? null, memberPrice, actorUserId],
      );
      const panelId = created.rows[0]!.id;
      await this.replacePanelMembers(client, panelId, input.memberItemIds);
      const panel = (await this.findPanelById(panelId, client))!;
      await this.audit.record({ ...event, resourceId: panelId, afterData: panel }, client);
      return panel;
    });
  }

  async create(input: {
    itemType: string; name: string; description?: string; unit?: string; price: number;
    trackInventory: boolean; openingQuantity: number; reorderLevel: number;
  }, actorUserId: string, event: AuditEventInput): Promise<CatalogItem> {
    return withTransaction(this.pool, async (client) => {
      const created = await client.query<{ id: string }>(
        `insert into clinic.catalog_items
          (item_type,name,description,unit,price,track_inventory,created_by,updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$7) returning id`,
        [input.itemType,input.name,input.description??null,input.unit??null,input.price,input.trackInventory,actorUserId],
      );
      const itemId = created.rows[0]!.id;
      if (input.trackInventory) {
        await client.query(
          "insert into clinic.inventory_balances (catalog_item_id,quantity_on_hand,reorder_level) values ($1,$2,$3)",
          [itemId,input.openingQuantity,input.reorderLevel],
        );
        if (input.openingQuantity > 0) {
          await client.query(
            `insert into clinic.inventory_movements
              (catalog_item_id,movement_type,quantity_delta,balance_after,reason,actor_user_id)
             values ($1,'opening',$2,$2,'Opening balance',$3)`,
            [itemId,input.openingQuantity,actorUserId],
          );
        }
      }
      const item = (await this.findById(itemId, client))!;
      await this.audit.record({ ...event, resourceId:itemId, afterData:item }, client);
      return item;
    });
  }

  async update(itemId: string, input: {
    name?: string; description?: string|null; unit?: string|null; price?: number; active?: boolean; reorderLevel?: number;
    memberItemIds?: string[];
  }, actorUserId: string, event: AuditEventInput): Promise<CatalogItem | LabPanel> {
    return withTransaction(this.pool, async (client) => {
      const before = await this.findById(itemId, client, true);
      if (!before) throw new AppError(404,"CATALOG_ITEM_NOT_FOUND","Catalog item was not found");
      if (before.item_type === "lab_panel") {
        if (input.unit !== undefined || input.reorderLevel !== undefined || input.price !== undefined) {
          throw new AppError(400,"PANEL_PRICE_COMPUTED","Lab panel price is computed from member tests");
        }
        if (input.memberItemIds) {
          const memberPrice = await this.validatePanelMembers(client, input.memberItemIds);
          await this.replacePanelMembers(client, itemId, input.memberItemIds);
          await client.query(
            "update clinic.catalog_items set price=$2,updated_by=$3,updated_at=now() where id=$1",
            [itemId, memberPrice, actorUserId],
          );
        }
      } else if (input.memberItemIds) {
        throw new AppError(400,"PANEL_MEMBERS_INVALID","Only lab panels can have member tests");
      }
      await client.query(
        `update clinic.catalog_items set name=coalesce($2,name),
          description=case when $3::boolean then $4 else description end,
          unit=case when $5::boolean then $6 else unit end,
          price=coalesce($7,price),active=coalesce($8,active),updated_by=$9,updated_at=now()
         where id=$1`,
        [itemId,input.name??null,'description' in input,input.description??null,'unit' in input,input.unit??null,
          input.price??null,input.active??null,actorUserId],
      );
      if (input.reorderLevel !== undefined) {
        const updated = await client.query(
          "update clinic.inventory_balances set reorder_level=$2,updated_at=now() where catalog_item_id=$1",
          [itemId,input.reorderLevel],
        );
        if (!updated.rowCount) throw new AppError(409,"INVENTORY_NOT_TRACKED","This item does not track inventory");
      }
      const after = before.item_type === "lab_panel"
        ? (await this.findPanelById(itemId, client))!
        : (await this.findById(itemId, client))!;
      await this.audit.record({ ...event, resourceId:itemId, beforeData:before, afterData:after }, client);
      return after;
    });
  }

  static async expandDiagnosticCatalogIds(database: Queryable, ids: string[]): Promise<string[]> {
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
        if (!members.rowCount) throw new AppError(400, "PANEL_EMPTY", "Lab panel has no active member tests");
        expanded.push(...members.rows.map((member) => member.member_item_id));
      } else {
        expanded.push(id);
      }
    }
    return [...new Set(expanded)];
  }

  async adjustInventory(itemId: string, delta: number, reason: string, actorUserId: string, event: AuditEventInput) {
    return withTransaction(this.pool, async (client) => {
      const balance = await client.query<{ quantity_on_hand: string }>(
        "select quantity_on_hand::text from clinic.inventory_balances where catalog_item_id=$1 for update",
        [itemId],
      );
      if (!balance.rows[0]) throw new AppError(409,"INVENTORY_NOT_TRACKED","This item does not track inventory");
      const next = Number(balance.rows[0].quantity_on_hand) + delta;
      if (next < 0) throw new AppError(409,"INSUFFICIENT_STOCK","Inventory adjustment would create negative stock");
      if(delta<0){
        let toRemove=-delta;
        const batches=await client.query<{id:string;quantity_remaining:string}>("select id,quantity_remaining::text from clinic.inventory_batches where catalog_item_id=$1 and quantity_remaining>0 order by (expiry_date<current_date) desc,expiry_date asc nulls last,received_at,id for update",[itemId]);
        for(const batch of batches.rows){if(toRemove<=0)break;const removed=Math.min(toRemove,Number(batch.quantity_remaining));await client.query("update clinic.inventory_batches set quantity_remaining=quantity_remaining-$2 where id=$1",[batch.id,removed]);toRemove-=removed;}
      }
      await client.query(
        "update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",
        [itemId,next],
      );
      await client.query(
        `insert into clinic.inventory_movements
          (catalog_item_id,movement_type,quantity_delta,balance_after,reason,actor_user_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [itemId,delta>0?'adjustment_in':'adjustment_out',delta,next,reason,actorUserId],
      );
      const item=(await this.findById(itemId,client))!;
      await this.audit.record({ ...event,resourceId:itemId,beforeData:{quantityOnHand:balance.rows[0].quantity_on_hand},afterData:{quantityOnHand:item.quantity_on_hand,reason}},client);
      return item;
    });
  }

  async receiveBatch(itemId:string,input:{batchNumber:string;supplierName:string;purchaseReference?:string;quantity:number;expiryDate?:string;unitCost?:number},actorUserId:string,event:AuditEventInput){
    return withTransaction(this.pool,async client=>{
      const item=await this.findById(itemId,client,true);
      if(!item)throw new AppError(404,"CATALOG_ITEM_NOT_FOUND","Catalog item was not found");
      if(!item.track_inventory)throw new AppError(409,"INVENTORY_NOT_TRACKED","This item does not track inventory");
      const balance=await client.query<{quantity_on_hand:string}>("select quantity_on_hand::text from clinic.inventory_balances where catalog_item_id=$1 for update",[itemId]);
      if(!balance.rows[0])throw new AppError(409,"INVENTORY_BALANCE_MISSING","Tracked item has no inventory balance");
      const created=await client.query<{id:string}>(
        `insert into clinic.inventory_batches(catalog_item_id,batch_number,supplier_name,purchase_reference,received_quantity,quantity_remaining,expiry_date,unit_cost,received_by)
         values($1,$2,$3,$4,$5,$5,$6,$7,$8) returning id`,
        [itemId,input.batchNumber,input.supplierName,input.purchaseReference??null,input.quantity,input.expiryDate??null,input.unitCost??null,actorUserId],
      );
      const next=Number(balance.rows[0].quantity_on_hand)+input.quantity;
      await client.query("update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",[itemId,next]);
      await client.query(`insert into clinic.inventory_movements(catalog_item_id,batch_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,reason,actor_user_id) values($1,$2,'receipt',$3,$4,'inventory_batch',$2,$5,$6)`,[itemId,created.rows[0]!.id,input.quantity,next,input.purchaseReference??input.supplierName,actorUserId]);
      const batch=(await client.query(`select b.id,b.catalog_item_id,c.item_code,c.name item_name,c.unit,b.batch_number,b.supplier_name,b.purchase_reference,b.received_quantity::text,b.quantity_remaining::text,b.expiry_date,b.unit_cost::text,b.received_by,u.full_name received_by_name,b.received_at,(b.expiry_date is not null and b.expiry_date<current_date) expired from clinic.inventory_batches b join clinic.catalog_items c on c.id=b.catalog_item_id join clinic.users u on u.id=b.received_by where b.id=$1`,[created.rows[0]!.id])).rows[0];
      await this.audit.record({...event,resourceId:created.rows[0]!.id,afterData:batch},client);
      return batch;
    });
  }

  async listInventoryBatches(limit:number,itemId?:string){
    const result=await this.pool.query(
      `select b.id,b.catalog_item_id,c.item_code,c.name item_name,c.unit,b.batch_number,b.supplier_name,b.purchase_reference,
        b.received_quantity::text,b.quantity_remaining::text,b.expiry_date,b.unit_cost::text,b.received_by,u.full_name received_by_name,b.received_at,
        (b.expiry_date is not null and b.expiry_date<current_date) expired,
        case when b.expiry_date is null then null else b.expiry_date-current_date end days_to_expiry
       from clinic.inventory_batches b join clinic.catalog_items c on c.id=b.catalog_item_id join clinic.users u on u.id=b.received_by
       where ($1::uuid is null or b.catalog_item_id=$1)
       order by b.expiry_date asc nulls last,b.received_at desc,b.id limit $2`,
      [itemId??null,limit],
    );
    return result.rows;
  }

  async listInventoryMovements(limit:number,itemId?:string){
    const result=await this.pool.query(
      `select m.id,m.catalog_item_id,c.item_code,c.name item_name,c.unit,m.movement_type,
        m.quantity_delta::text,m.balance_after::text,m.reason,m.reference_type,m.reference_id,
        m.actor_user_id,u.full_name actor_name,m.occurred_at
       from clinic.inventory_movements m
       join clinic.catalog_items c on c.id=m.catalog_item_id
       join clinic.users u on u.id=m.actor_user_id
       where ($1::uuid is null or m.catalog_item_id=$1)
       order by m.occurred_at desc,m.id desc limit $2`,
      [itemId??null,limit],
    );
    return result.rows;
  }

  private async findById(itemId:string,database:Queryable,lock=false):Promise<CatalogItem|null>{
    const result=await database.query<CatalogItem>(`${SELECT_ITEM} where c.id=$1 ${lock?'for update of c':''}`,[itemId]);
    return result.rows[0]??null;
  }

  private async findPanelById(panelId: string, database: Queryable): Promise<LabPanel | null> {
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

  private async validatePanelMembers(database: Queryable, memberItemIds: string[]): Promise<number> {
    const members = await database.query<{ price: string }>(
      `select price::text from clinic.catalog_items
       where id=any($1::uuid[]) and active=true and item_type in ('lab_test','radiology')`,
      [memberItemIds],
    );
    if (members.rowCount !== memberItemIds.length) {
      throw new AppError(400, "PANEL_MEMBER_INVALID", "One or more panel member tests are invalid");
    }
    return members.rows.reduce((sum, member) => sum + Number(member.price), 0);
  }

  private async replacePanelMembers(database: Queryable, panelId: string, memberItemIds: string[]): Promise<void> {
    await database.query("delete from clinic.catalog_panel_members where panel_id=$1", [panelId]);
    for (let index = 0; index < memberItemIds.length; index += 1) {
      await database.query(
        "insert into clinic.catalog_panel_members (panel_id,member_item_id,sort_order) values ($1,$2,$3)",
        [panelId, memberItemIds[index], index],
      );
    }
  }
}






