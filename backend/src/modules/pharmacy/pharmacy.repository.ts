import type { Pool,PoolClient } from "pg";import { withTransaction } from "../../database/transaction";import type { Queryable } from "../../database/types";import { AppError } from "../../shared/errors/app-error";import type { AuditEventInput } from "../audit/audit.repository";import { AuditRepository } from "../audit/audit.repository";
export type Prescription={id:string;visit_id:string;encounter_id:string;patient_id:string;visit_number:string;patient_name:string;prescriber_id:string;prescriber_name:string;status:string;notes:string|null;prescribed_at:Date;items:Array<Record<string,unknown>>};
const SELECT_RX=`select r.id,r.visit_id,r.encounter_id,r.patient_id,v.visit_number,concat_ws(' ',p.first_name,p.middle_name,p.last_name) patient_name,
 r.prescriber_id,u.full_name prescriber_name,r.status,r.notes,r.prescribed_at,coalesce((select jsonb_agg(jsonb_build_object(
 'id',i.id,'catalog_item_id',i.catalog_item_id,'drug_name',i.drug_name,'dosage',i.dosage,'frequency',i.frequency,
 'duration',i.duration,'instructions',i.instructions,'quantity_prescribed',i.quantity_prescribed,'quantity_dispensed',i.quantity_dispensed,'unit_price',i.unit_price)
 order by i.created_at,i.id) from clinic.prescription_items i where i.prescription_id=r.id),'[]'::jsonb) items
 from clinic.prescriptions r join clinic.visits v on v.id=r.visit_id join clinic.patients p on p.id=r.patient_id join clinic.users u on u.id=r.prescriber_id`;
export class PharmacyRepository{constructor(private readonly pool:Pool,private readonly audit:AuditRepository){}
 async create(encounterId:string,items:Array<{catalogItemId:string;dosage:string;frequency:string;duration:string;instructions?:string;quantity:number}>,notes:string|undefined,actor:string,event:AuditEventInput):Promise<Prescription>{return withTransaction(this.pool,async c=>{
  const er=await c.query<{visit_id:string;patient_id:string;clinician_id:string;status:string}>("select visit_id,patient_id,clinician_id,status from clinic.encounters where id=$1 for update",[encounterId]);const e=er.rows[0];if(!e)throw new AppError(404,"ENCOUNTER_NOT_FOUND","Encounter was not found");if(e.status!=="open")throw new AppError(409,"ENCOUNTER_SIGNED","Prescriptions cannot be added to a signed encounter");if(e.clinician_id!==actor)throw new AppError(403,"ENCOUNTER_OWNED_BY_ANOTHER_CLINICIAN","Only the encounter clinician can prescribe");
  const drugs=await c.query<{id:string;name:string;price:string}>("select id,name,price::text from clinic.catalog_items where id=any($1::uuid[]) and item_type='drug' and active=true order by id",[items.map(x=>x.catalogItemId)]);if(drugs.rowCount!==items.length)throw new AppError(400,"DRUG_INVALID","One or more drugs are invalid or inactive");const map=new Map(drugs.rows.map(x=>[x.id,x]));
  const rr=await c.query<{id:string}>("insert into clinic.prescriptions(visit_id,encounter_id,patient_id,prescriber_id,notes) values($1,$2,$3,$4,$5) returning id",[e.visit_id,encounterId,e.patient_id,actor,notes??null]);const id=rr.rows[0]!.id;
  for(const i of items){const d=map.get(i.catalogItemId)!;await c.query(`insert into clinic.prescription_items(prescription_id,catalog_item_id,drug_name,dosage,frequency,duration,instructions,quantity_prescribed,unit_price) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,i.catalogItemId,d.name,i.dosage,i.frequency,i.duration,i.instructions??null,i.quantity,d.price]);}
  await c.query("update clinic.visits set status='medication_prescribed',updated_at=now() where id=$1",[e.visit_id]);const rx=(await this.find(id,c))!;await this.audit.record({...event,resourceId:id,afterData:rx},c);return rx;
 });}
 async listWorklist(limit:number){const r=await this.pool.query<Prescription>(`${SELECT_RX} where r.status in('payment_approved','partially_dispensed') order by r.prescribed_at,r.id limit $1`,[limit]);return r.rows;}
 async findByVisit(visitId:string){const r=await this.pool.query<Prescription>(`${SELECT_RX} where r.visit_id=$1 order by r.prescribed_at desc`,[visitId]);return r.rows;}
 async dispense(id:string,requests:Array<{prescriptionItemId:string;quantity:number}>,notes:string|undefined,actor:string,event:AuditEventInput){return withTransaction(this.pool,async c=>{
  const rxr=await c.query<{id:string;visit_id:string;status:string}>("select id,visit_id,status from clinic.prescriptions where id=$1 for update",[id]);const rx=rxr.rows[0];if(!rx)throw new AppError(404,"PRESCRIPTION_NOT_FOUND","Prescription was not found");if(!["payment_approved","partially_dispensed"].includes(rx.status))throw new AppError(409,"PRESCRIPTION_NOT_DISPENSABLE","Prescription is not approved for dispensing");
  await c.query("update clinic.queue_entries set status='in_service',assigned_user_id=$2,service_started_at=coalesce(service_started_at,now()),updated_at=now() where visit_id=$1 and station='pharmacy' and status in('waiting','called','in_service')",[rx.visit_id,actor]);
  const rows=await c.query<{id:string;catalog_item_id:string;quantity_prescribed:string;quantity_dispensed:string;track_inventory:boolean}>(`select i.id,i.catalog_item_id,i.quantity_prescribed::text,i.quantity_dispensed::text,d.track_inventory from clinic.prescription_items i join clinic.catalog_items d on d.id=i.catalog_item_id where i.prescription_id=$1 and i.id=any($2::uuid[]) order by i.catalog_item_id,i.id for update of i`,[id,requests.map(x=>x.prescriptionItemId)]);if(rows.rowCount!==requests.length)throw new AppError(400,"PRESCRIPTION_ITEM_INVALID","One or more items do not belong to this prescription");
  const tracked=rows.rows.filter(x=>x.track_inventory).map(x=>x.catalog_item_id).sort();const balances=tracked.length?await c.query<{catalog_item_id:string;quantity_on_hand:string}>("select catalog_item_id,quantity_on_hand::text from clinic.inventory_balances where catalog_item_id=any($1::uuid[]) order by catalog_item_id for update",[tracked]):{rows:[]};const balanceMap=new Map(balances.rows.map(x=>[x.catalog_item_id,Number(x.quantity_on_hand)]));const requestMap=new Map(requests.map(x=>[x.prescriptionItemId,x.quantity]));
  for(const item of rows.rows){
    const qty=requestMap.get(item.id)!;const remaining=Number(item.quantity_prescribed)-Number(item.quantity_dispensed);
    if(qty>remaining)throw new AppError(409,"DISPENSE_QUANTITY_EXCEEDED",`Dispense quantity exceeds remaining amount for item ${item.id}`);
    const allocations:Array<{batchId:string;quantity:number}>=[];
    if(item.track_inventory){
      const stock=balanceMap.get(item.catalog_item_id);if(stock===undefined)throw new AppError(409,"INVENTORY_BALANCE_MISSING","Tracked drug has no inventory balance");
      const batches=await c.query<{id:string;quantity_remaining:string;usable:boolean}>("select id,quantity_remaining::text,(expiry_date is null or expiry_date>=current_date) usable from clinic.inventory_batches where catalog_item_id=$1 and quantity_remaining>0 order by expiry_date asc nulls last,received_at,id for update",[item.catalog_item_id]);
      const batchTotal=batches.rows.reduce((sum,b)=>sum+Number(b.quantity_remaining),0);const legacy=Math.max(0,stock-batchTotal);
      const usable=batches.rows.filter(b=>b.usable);
      const available=Math.min(stock,legacy+usable.reduce((sum,b)=>sum+Number(b.quantity_remaining),0));
      if(qty>available)throw new AppError(409,"INSUFFICIENT_USABLE_STOCK",`Only ${available} non-expired units are available for prescription item ${item.id}`);
      let toAllocate=qty;
      for(const batch of usable){if(toAllocate<=0)break;const allocated=Math.min(toAllocate,Number(batch.quantity_remaining));if(allocated<=0)continue;await c.query("update clinic.inventory_batches set quantity_remaining=quantity_remaining-$2 where id=$1",[batch.id,allocated]);allocations.push({batchId:batch.id,quantity:allocated});toAllocate-=allocated;}
      const next=stock-qty;balanceMap.set(item.catalog_item_id,next);
      await c.query("update clinic.inventory_balances set quantity_on_hand=$2,version=version+1,updated_at=now() where catalog_item_id=$1",[item.catalog_item_id,next]);
      await c.query(`insert into clinic.inventory_movements(catalog_item_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,actor_user_id) values($1,'dispense',$2,$3,'prescription',$4,$5)`,[item.catalog_item_id,-qty,next,id,actor]);
    }
    await c.query("update clinic.prescription_items set quantity_dispensed=quantity_dispensed+$2 where id=$1",[item.id,qty]);
    const dispensing=await c.query<{id:string}>("insert into clinic.dispensing_events(prescription_item_id,quantity,dispensed_by,notes) values($1,$2,$3,$4) returning id",[item.id,qty,actor,notes??null]);
    for(const allocation of allocations)await c.query("insert into clinic.dispensing_batch_allocations(dispensing_event_id,inventory_batch_id,quantity) values($1,$2,$3)",[dispensing.rows[0]!.id,allocation.batchId,allocation.quantity]);
  }
  const remaining=await c.query<{count:string}>("select count(*)::text count from clinic.prescription_items where prescription_id=$1 and quantity_dispensed<quantity_prescribed",[id]);const status=Number(remaining.rows[0]!.count)===0?"dispensed":"partially_dispensed";await c.query("update clinic.prescriptions set status=$2,updated_at=now() where id=$1",[id,status]);if(status==="dispensed")await completePharmacy(c,rx.visit_id);
  const after=(await this.find(id,c))!;await this.audit.record({...event,resourceId:id,afterData:{prescription:after,dispensed:requests}},c);return after;
 });}
 private async find(id:string,db:Queryable){const r=await db.query<Prescription>(`${SELECT_RX} where r.id=$1`,[id]);return r.rows[0]??null;}
}
async function completePharmacy(c:PoolClient,visitId:string){await c.query(`update clinic.queue_entries set status='completed',completed_at=now(),updated_at=now() where visit_id=$1 and station='pharmacy' and status in('waiting','called','in_service')`,[visitId]);const paid=await c.query("select 1 from clinic.invoices where visit_id=$1 and status='paid'",[visitId]);if(paid.rowCount)await c.query("update clinic.visits set status='billed',completed_at=now(),updated_at=now() where id=$1",[visitId]);}








