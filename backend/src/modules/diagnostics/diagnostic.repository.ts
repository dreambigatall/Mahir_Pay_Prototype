import type { Pool,PoolClient } from "pg";
import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import { CatalogRepository } from "../catalog/catalog.repository";

export type DiagnosticOrder={id:string;visit_id:string;encounter_id:string;patient_id:string;visit_number:string;patient_name:string;urgency:string;status:string;clinical_notes:string|null;ordered_by:string;ordered_at:Date;items:Array<Record<string,unknown>>};
const SELECT_ORDER=`select o.id,o.visit_id,o.encounter_id,o.patient_id,v.visit_number,
 concat_ws(' ',p.first_name,p.middle_name,p.last_name) patient_name,o.urgency,o.status,o.clinical_notes,o.ordered_by,o.ordered_at,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'catalog_item_id',i.catalog_item_id,'item_name',i.item_name,
 'item_type',i.item_type,'status',i.status,
 'result_setup',(select c.result_setup from clinic.catalog_items c where c.id=i.catalog_item_id),'result',case when r.id is null then null else jsonb_build_object(
 'id',r.id,'result_value',r.result_value,'result_unit',r.result_unit,'result_flag',r.result_flag,
 'reference_range',r.reference_range,'notes',r.notes,'entered_by',r.entered_by,'entered_at',r.entered_at,
 'verified_by',r.verified_by,'verified_at',r.verified_at) end) order by i.created_at,i.id)
 from clinic.diagnostic_order_items i left join clinic.diagnostic_results r on r.diagnostic_order_item_id=i.id
 where i.diagnostic_order_id=o.id),'[]'::jsonb) items
 from clinic.diagnostic_orders o join clinic.visits v on v.id=o.visit_id join clinic.patients p on p.id=o.patient_id`;

export class DiagnosticRepository{
 constructor(private readonly pool:Pool,private readonly audit:AuditRepository){}
 async create(encounterId:string,itemIds:string[],urgency:string,notes:string|undefined,actor:string,event:AuditEventInput):Promise<DiagnosticOrder>{
  return withTransaction(this.pool,async(client)=>{
   const encounter=await client.query<{visit_id:string;patient_id:string;clinician_id:string;status:string}>("select visit_id,patient_id,clinician_id,status from clinic.encounters where id=$1 for update",[encounterId]);
   const e=encounter.rows[0];if(!e)throw new AppError(404,"ENCOUNTER_NOT_FOUND","Encounter was not found");
   if(e.status!=="open")throw new AppError(409,"ENCOUNTER_SIGNED","Diagnostics cannot be added to a signed encounter");
   if(e.clinician_id!==actor)throw new AppError(403,"ENCOUNTER_OWNED_BY_ANOTHER_CLINICIAN","Only the encounter clinician can order diagnostics");
   const visit=await client.query<{status:string}>("select status from clinic.visits where id=$1 for update",[e.visit_id]);
   const visitStatus=visit.rows[0]?.status;
   if(!visitStatus)throw new AppError(404,"VISIT_NOT_FOUND","Visit was not found");
   if(["completed","billed"].includes(visitStatus)){
    throw new AppError(409,"VISIT_NOT_ACTIVE","This visit is no longer active for new laboratory orders");
   }
   const expandedIds=await CatalogRepository.expandDiagnosticCatalogIds(client,itemIds);
   const items=await client.query<{id:string;name:string;item_type:string}>(
    "select id,name,item_type from clinic.catalog_items where id=any($1::uuid[]) and active=true and item_type in ('lab_test','radiology') order by id",[expandedIds]);
   if(items.rowCount!==expandedIds.length)throw new AppError(400,"DIAGNOSTIC_ITEM_INVALID","One or more diagnostic catalog items are invalid");
   const created=await client.query<{id:string}>(`insert into clinic.diagnostic_orders
    (visit_id,encounter_id,patient_id,ordered_by,urgency,clinical_notes) values($1,$2,$3,$4,$5,$6) returning id`,
    [e.visit_id,encounterId,e.patient_id,actor,urgency,notes??null]);
   const orderId=created.rows[0]!.id;
   await client.query(`insert into clinic.diagnostic_order_items(diagnostic_order_id,catalog_item_id,item_name,item_type)
    select $1,x.id,x.name,x.item_type from unnest($2::uuid[],$3::text[],$4::text[]) as x(id,name,item_type)`,
    [orderId,items.rows.map(x=>x.id),items.rows.map(x=>x.name),items.rows.map(x=>x.item_type)]);
   await moveVisitToLab(client,e.visit_id,urgency,actor);
   const order=(await this.find(orderId,client))!;await this.audit.record({...event,resourceId:orderId,afterData:order},client);return order;
  });
 }
 async list(status:string|undefined,limit:number,includeReviewed=false){
  const r=await this.pool.query<DiagnosticOrder>(`${SELECT_ORDER}
  where o.status <> 'cancelled'
    and ($1::text is null or o.status=$1)
    and (
      o.status <> 'reviewed'
      or ($3::boolean and o.reviewed_at >= current_date)
    )
  order by case o.urgency when 'urgent' then 1 else 2 end,o.ordered_at desc,o.id limit $2`,[status??null,limit,includeReviewed]);
  return r.rows;
 }
 async findById(orderId:string){const r=await this.pool.query<DiagnosticOrder>(`${SELECT_ORDER} where o.id=$1`,[orderId]);return r.rows[0]??null;}
 async start(orderId:string,actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const current=await lockOrder(client,orderId);if(current.status!=="requested")throw new AppError(409,"DIAGNOSTIC_TRANSITION_INVALID","Only requested orders can be started");
  await client.query("update clinic.diagnostic_orders set status='in_progress',updated_at=now() where id=$1",[orderId]);
  await client.query("update clinic.diagnostic_order_items set status='in_progress',updated_at=now() where diagnostic_order_id=$1 and status='requested'",[orderId]);
  await client.query(`update clinic.queue_entries set status='in_service',assigned_user_id=$2,service_started_at=coalesce(service_started_at,now()),updated_at=now()
   where visit_id=$1 and station='lab' and status in('waiting','called')`,[current.visit_id,actor]);
  const after=(await this.find(orderId,client))!;await this.audit.record({...event,resourceId:orderId,afterData:after},client);return after;
 });}
 async enterResult(itemId:string,input:{resultValue:string;resultUnit?:string;resultFlag?:string;referenceRange?:string;notes?:string},actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const item=await client.query<{diagnostic_order_id:string;status:string}>("select diagnostic_order_id,status from clinic.diagnostic_order_items where id=$1 for update",[itemId]);
  const row=item.rows[0];if(!row)throw new AppError(404,"DIAGNOSTIC_ITEM_NOT_FOUND","Diagnostic item was not found");
  if(!["requested","in_progress","result_ready"].includes(row.status))throw new AppError(409,"RESULT_LOCKED","Verified results cannot be changed");
  const existing=await client.query<{verified_at:Date|null}>("select verified_at from clinic.diagnostic_results where diagnostic_order_item_id=$1 for update",[itemId]);
  if(existing.rows[0]?.verified_at)throw new AppError(409,"RESULT_VERIFIED","Verified results cannot be changed");
  await client.query(`insert into clinic.diagnostic_results(diagnostic_order_item_id,result_value,result_unit,result_flag,reference_range,notes,entered_by)
   values($1,$2,$3,$4,$5,$6,$7) on conflict(diagnostic_order_item_id) do update set result_value=excluded.result_value,
   result_unit=excluded.result_unit,result_flag=excluded.result_flag,reference_range=excluded.reference_range,notes=excluded.notes,
   entered_by=excluded.entered_by,entered_at=now()`,[itemId,input.resultValue,input.resultUnit??null,input.resultFlag??null,input.referenceRange??null,input.notes??null,actor]);
  await client.query("update clinic.diagnostic_order_items set status='result_ready',updated_at=now() where id=$1",[itemId]);
  await refreshOrderStatus(client,row.diagnostic_order_id);
  const after=(await this.find(row.diagnostic_order_id,client))!;await this.audit.record({...event,resourceId:itemId,afterData:input},client);return after;
 });}
 async verify(itemId:string,actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const item=await client.query<{diagnostic_order_id:string;status:string}>("select diagnostic_order_id,status from clinic.diagnostic_order_items where id=$1 for update",[itemId]);
  const row=item.rows[0];if(!row)throw new AppError(404,"DIAGNOSTIC_ITEM_NOT_FOUND","Diagnostic item was not found");
  if(row.status!=="result_ready")throw new AppError(409,"RESULT_NOT_READY","Result is not ready for verification");
  const updated=await client.query("update clinic.diagnostic_results set verified_by=$2,verified_at=now() where diagnostic_order_item_id=$1 and verified_at is null",[itemId,actor]);
  if(!updated.rowCount)throw new AppError(409,"RESULT_NOT_READY","A result must be entered before verification");
  await client.query("update clinic.diagnostic_order_items set status='verified',updated_at=now() where id=$1",[itemId]);
  const order=await refreshOrderStatus(client,row.diagnostic_order_id);
  if(order.status==="verified")await returnVisitToDoctor(client,order.visit_id,actor);
  const after=(await this.find(row.diagnostic_order_id,client))!;await this.audit.record({...event,resourceId:itemId,afterData:{verified:true}},client);return after;
 });}
 async review(orderId:string,actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const current=await lockOrder(client,orderId);if(current.status!=="verified")throw new AppError(409,"ORDER_NOT_VERIFIED","All results must be verified before review");
  await client.query("update clinic.diagnostic_orders set status='reviewed',reviewed_by=$2,reviewed_at=now(),updated_at=now() where id=$1",[orderId,actor]);
  await client.query("update clinic.diagnostic_order_items set status='reviewed',updated_at=now() where diagnostic_order_id=$1",[orderId]);
  await client.query("update clinic.visits set status='in_consultation',updated_at=now() where id=$1",[current.visit_id]);
  await client.query(`update clinic.queue_entries set status='in_service',assigned_user_id=$2,service_started_at=coalesce(service_started_at,now()),updated_at=now()
   where visit_id=$1 and station='doctor' and status in('waiting','called')`,[current.visit_id,actor]);
  const after=(await this.find(orderId,client))!;await this.audit.record({...event,resourceId:orderId,afterData:after},client);return after;
 });}
 async cancelOrder(orderId:string,reason:string|undefined,actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const current=await requireRequestedOrder(client,orderId,actor);const before=(await this.find(orderId,client))!;
  await client.query(`update clinic.diagnostic_order_items set status='cancelled',updated_at=now()
   where diagnostic_order_id=$1 and status='requested'`,[orderId]);
  await client.query(`update clinic.diagnostic_orders set status='cancelled',cancelled_by=$2,cancelled_at=now(),
   cancellation_reason=$3,updated_at=now() where id=$1`,[orderId,actor,reason??null]);
  await maybeReturnVisitFromLab(client,current.visit_id,actor);
  const after=(await this.find(orderId,client))!;await this.audit.record({...event,resourceId:orderId,beforeData:before,afterData:after},client);return after;
 });}
 async cancelItem(itemId:string,reason:string|undefined,actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const item=await client.query<{id:string;diagnostic_order_id:string;status:string}>(
   "select id,diagnostic_order_id,status from clinic.diagnostic_order_items where id=$1 for update",[itemId]);
  const row=item.rows[0];if(!row)throw new AppError(404,"DIAGNOSTIC_ITEM_NOT_FOUND","Diagnostic item was not found");
  if(row.status!=="requested")throw new AppError(409,"DIAGNOSTIC_ITEM_LOCKED","Only tests not yet started by the laboratory can be removed");
  const current=await requireRequestedOrder(client,row.diagnostic_order_id,actor);
  const before=(await this.find(row.diagnostic_order_id,client))!;
  await client.query("update clinic.diagnostic_order_items set status='cancelled',updated_at=now() where id=$1",[itemId]);
  const remaining=await client.query<{count:string}>(
   "select count(*)::text as count from clinic.diagnostic_order_items where diagnostic_order_id=$1 and status <> 'cancelled'",
   [row.diagnostic_order_id],
  );
  if(Number(remaining.rows[0]!.count)===0){
   await client.query(`update clinic.diagnostic_orders set status='cancelled',cancelled_by=$2,cancelled_at=now(),
    cancellation_reason=$3,updated_at=now() where id=$1`,[row.diagnostic_order_id,actor,reason??null]);
  }
  await maybeReturnVisitFromLab(client,current.visit_id,actor);
  const after=(await this.find(row.diagnostic_order_id,client))!;await this.audit.record({...event,resourceId:itemId,beforeData:before,afterData:after},client);return after;
 });}
 async updateOrder(orderId:string,input:{urgency?:string;clinicalNotes?:string|null},actor:string,event:AuditEventInput){return withTransaction(this.pool,async(client)=>{
  const before=(await this.find(orderId,client))!;await requireRequestedOrder(client,orderId,actor);
  const sets=["updated_at=now()"];const params:unknown[]=[orderId];let index=2;
  if(input.urgency!==undefined){sets.push(`urgency=$${index++}`);params.push(input.urgency);}
  if(input.clinicalNotes!==undefined){sets.push(`clinical_notes=$${index++}`);params.push(input.clinicalNotes);}
  await client.query(`update clinic.diagnostic_orders set ${sets.join(", ")} where id=$1`,params);
  const after=(await this.find(orderId,client))!;await this.audit.record({...event,resourceId:orderId,beforeData:before,afterData:after},client);return after;
 });}
 private async find(id:string,db:Queryable){const r=await db.query<DiagnosticOrder>(`${SELECT_ORDER} where o.id=$1`,[id]);return r.rows[0]??null;}
}
async function lockOrder(client:PoolClient,id:string){const r=await client.query<{id:string;visit_id:string;status:string}>("select id,visit_id,status from clinic.diagnostic_orders where id=$1 for update",[id]);if(!r.rows[0])throw new AppError(404,"DIAGNOSTIC_ORDER_NOT_FOUND","Diagnostic order was not found");return r.rows[0];}
async function requireRequestedOrder(client:PoolClient,orderId:string,actor:string){
 const r=await client.query<{id:string;visit_id:string;status:string;clinician_id:string;encounter_status:string}>(
  `select o.id,o.visit_id,o.status,e.clinician_id,e.status as encounter_status
   from clinic.diagnostic_orders o join clinic.encounters e on e.id=o.encounter_id
   where o.id=$1 for update`,[orderId]);
 const row=r.rows[0];if(!row)throw new AppError(404,"DIAGNOSTIC_ORDER_NOT_FOUND","Diagnostic order was not found");
 if(row.status!=="requested")throw new AppError(409,"DIAGNOSTIC_ORDER_LOCKED","This laboratory order can no longer be changed because work has started");
 if(row.encounter_status!=="open")throw new AppError(409,"ENCOUNTER_SIGNED","Diagnostics cannot be changed on a signed encounter");
 if(row.clinician_id!==actor)throw new AppError(403,"ENCOUNTER_OWNED_BY_ANOTHER_CLINICIAN","Only the encounter clinician can change diagnostics");
 return row;
}
async function maybeReturnVisitFromLab(c:PoolClient,visitId:string,actor:string){
 const active=await c.query("select 1 from clinic.diagnostic_orders where visit_id=$1 and status not in ('cancelled','reviewed') limit 1",[visitId]);
 if(active.rowCount)return;
 const visit=await c.query<{status:string;cancellation_reason:string|null}>(
  "select status, cancellation_reason from clinic.visits where id=$1 for update",
  [visitId],
 );
 const row=visit.rows[0];
 if(!row)return;
 const openEncounter=await c.query("select 1 from clinic.encounters where visit_id=$1 and status='open' limit 1",[visitId]);
 if(!openEncounter.rowCount)return;
 const shouldRestore=row.status==="awaiting_lab"||row.status==="cancelled";
 if(!shouldRestore)return;
 await c.query(
  `update clinic.queue_entries set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
   where visit_id=$1 and station='lab' and status in ('waiting','called','in_service')`,
  [visitId],
 );
 await c.query(
  "update clinic.visits set status='in_consultation',cancelled_at=null,cancellation_reason=null,updated_at=now() where id=$1",
  [visitId],
 );
 const doctorQueue=await c.query<{id:string}>(
  "select id from clinic.queue_entries where visit_id=$1 and station='doctor' and status in ('waiting','called','in_service') limit 1",
  [visitId],
 );
 if(!doctorQueue.rowCount){
  const q=await c.query<{id:string}>(
   "insert into clinic.queue_entries(visit_id,station,priority) select id,'doctor',priority from clinic.visits where id=$1 returning id",
   [visitId],
  );
  await c.query(
   "insert into clinic.queue_events(queue_entry_id,from_status,to_status,actor_user_id,notes) values($1,null,'in_service',$2,'Returned to doctor after laboratory order cancelled')",
   [q.rows[0]!.id,actor],
  );
  await c.query(
   `update clinic.queue_entries set status='in_service',assigned_user_id=$2,
    service_started_at=coalesce(service_started_at,now()),updated_at=now() where id=$1`,
   [q.rows[0]!.id,actor],
  );
 }else{
  await c.query(
   `update clinic.queue_entries set assigned_user_id=coalesce(assigned_user_id,$2),updated_at=now()
    where id=$1`,
   [doctorQueue.rows[0]!.id,actor],
  );
 }
}
async function moveVisitToLab(c:PoolClient,visitId:string,urgency:string,actor:string){
 await c.query(
  `update clinic.visits set status='awaiting_lab',cancelled_at=null,cancellation_reason=null,updated_at=now() where id=$1`,
  [visitId],
 );
 await c.query(`update clinic.queue_entries set status='completed',completed_at=now(),updated_at=now() where visit_id=$1 and station='doctor' and status in('waiting','called','in_service')`,[visitId]);
 const existingLab=await c.query<{id:string}>(
  `select id from clinic.queue_entries where visit_id=$1 and station='lab'
   and status in ('waiting','called','in_service') limit 1 for update`,
  [visitId],
 );
 if(existingLab.rows[0]){
  if(urgency==="urgent"){
   await c.query("update clinic.queue_entries set priority='urgent',updated_at=now() where id=$1",[existingLab.rows[0].id]);
  }
  return;
 }
 const q=await c.query<{id:string}>("insert into clinic.queue_entries(visit_id,station,priority) values($1,'lab',$2) returning id",[visitId,urgency]);
 await c.query("insert into clinic.queue_events(queue_entry_id,from_status,to_status,actor_user_id,notes) values($1,null,'waiting',$2,'Diagnostics ordered')",[q.rows[0]!.id,actor]);
}
async function refreshOrderStatus(c:PoolClient,orderId:string){
 const statuses=await c.query<{status:string}>("select status from clinic.diagnostic_order_items where diagnostic_order_id=$1 and status <> 'cancelled'",[orderId]);
 if(!statuses.rowCount){
  const r=await c.query<{visit_id:string;status:string}>("update clinic.diagnostic_orders set status='cancelled',updated_at=now() where id=$1 returning visit_id,status",[orderId]);
  return r.rows[0]!;
 }
 const allVerified=statuses.rows.every(x=>x.status==="verified");const allReady=statuses.rows.every(x=>["result_ready","verified"].includes(x.status));
 const status=allVerified?"verified":allReady?"result_ready":"in_progress";
 const r=await c.query<{visit_id:string;status:string}>("update clinic.diagnostic_orders set status=$2,updated_at=now() where id=$1 returning visit_id,status",[orderId,status]);return r.rows[0]!;
}
async function returnVisitToDoctor(c:PoolClient,visitId:string,actor:string){
 await c.query("update clinic.visits set status='lab_complete',updated_at=now() where id=$1",[visitId]);
 await c.query(`update clinic.queue_entries set status='completed',completed_at=now(),updated_at=now() where visit_id=$1 and station='lab' and status in('waiting','called','in_service')`,[visitId]);
 const q=await c.query<{id:string}>("insert into clinic.queue_entries(visit_id,station,priority) select id,'doctor',priority from clinic.visits where id=$1 returning id",[visitId]);
 await c.query("insert into clinic.queue_events(queue_entry_id,from_status,to_status,actor_user_id,notes) values($1,null,'waiting',$2,'Diagnostic results verified')",[q.rows[0]!.id,actor]);
}
