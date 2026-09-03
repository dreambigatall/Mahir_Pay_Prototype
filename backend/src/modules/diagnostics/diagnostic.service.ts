import type { RequestMetadata } from "../audit/audit.repository";
import { DiagnosticRepository } from "./diagnostic.repository";
export class DiagnosticService{
 constructor(private readonly repo:DiagnosticRepository){}
 create(actor:string,input:{encounterId:string;catalogItemIds:string[];urgency:string;clinicalNotes?:string},m:RequestMetadata){return this.repo.create(input.encounterId,input.catalogItemIds,input.urgency,input.clinicalNotes,actor,{...m,actorUserId:actor,action:"diagnostic.ordered",resourceType:"diagnostic_order"});}
 list(status:string|undefined,limit:number,includeReviewed=false){return this.repo.list(status,limit,includeReviewed);}
 getById(id:string){return this.repo.findById(id);}
 start(id:string,actor:string,m:RequestMetadata){return this.repo.start(id,actor,{...m,actorUserId:actor,action:"diagnostic.started",resourceType:"diagnostic_order"});}
 enterResult(id:string,input:Parameters<DiagnosticRepository["enterResult"]>[1],actor:string,m:RequestMetadata){return this.repo.enterResult(id,input,actor,{...m,actorUserId:actor,action:"diagnostic.result_entered",resourceType:"diagnostic_order_item"});}
 verify(id:string,actor:string,m:RequestMetadata){return this.repo.verify(id,actor,{...m,actorUserId:actor,action:"diagnostic.result_verified",resourceType:"diagnostic_order_item"});}
 review(id:string,actor:string,m:RequestMetadata){return this.repo.review(id,actor,{...m,actorUserId:actor,action:"diagnostic.reviewed",resourceType:"diagnostic_order"});}
 cancelOrder(id:string,reason:string|undefined,actor:string,m:RequestMetadata){return this.repo.cancelOrder(id,reason,actor,{...m,actorUserId:actor,action:"diagnostic.order_cancelled",resourceType:"diagnostic_order"});}
 cancelItem(id:string,reason:string|undefined,actor:string,m:RequestMetadata){return this.repo.cancelItem(id,reason,actor,{...m,actorUserId:actor,action:"diagnostic.item_cancelled",resourceType:"diagnostic_order_item"});}
 updateOrder(id:string,input:{urgency?:string;clinicalNotes?:string|null},actor:string,m:RequestMetadata){return this.repo.updateOrder(id,input,actor,{...m,actorUserId:actor,action:"diagnostic.order_updated",resourceType:"diagnostic_order"});}
}
