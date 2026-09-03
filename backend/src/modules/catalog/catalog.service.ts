import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { CatalogRepository } from "./catalog.repository";
import type { CatalogCreateInput, CatalogUpdateInput } from "./catalog.schemas";

export class CatalogService {
  constructor(private readonly repository:CatalogRepository){}
  list(type:string|undefined,search:string|undefined,includeInactive:boolean,limit:number){
    return this.repository.list(type,search,includeInactive,limit);
  }
  listPanels(includeInactive:boolean,limit:number){
    return this.repository.listPanels(includeInactive,limit);
  }
  async create(actor:string,input:CatalogCreateInput,metadata:RequestMetadata){
    try{
      if(input.itemType==="lab_panel"){
        return await this.repository.createLabPanel(
          { name:input.name, description:input.description, memberItemIds:input.memberItemIds },
          actor,
          {...metadata,actorUserId:actor,action:"catalog.panel_created",resourceType:"catalog_item"},
        );
      }
      return await this.repository.create(input,actor,{...metadata,actorUserId:actor,action:"catalog.created",resourceType:"catalog_item"});
    }
    catch(error){if(isUnique(error))throw new AppError(409,"CATALOG_ITEM_EXISTS","A catalog item with this type and name already exists");throw error;}
  }
  async update(id:string,actor:string,input:CatalogUpdateInput,metadata:RequestMetadata){
    try{return await this.repository.update(id,input,actor,{...metadata,actorUserId:actor,action:"catalog.updated",resourceType:"catalog_item"});}
    catch(error){if(isUnique(error))throw new AppError(409,"CATALOG_ITEM_EXISTS","A catalog item with this type and name already exists");throw error;}
  }
  async receiveInventory(id:string,input:Parameters<CatalogRepository["receiveBatch"]>[1],actor:string,metadata:RequestMetadata){
    try{return await this.repository.receiveBatch(id,input,actor,{...metadata,actorUserId:actor,action:"inventory.received",resourceType:"inventory_batch"});}
    catch(error){if(isUnique(error))throw new AppError(409,"INVENTORY_BATCH_EXISTS","This batch number already exists for the selected medication");throw error;}
  }
  listInventoryBatches(limit:number,itemId?:string){return this.repository.listInventoryBatches(limit,itemId);}
  listInventoryMovements(limit:number,itemId?:string){
    return this.repository.listInventoryMovements(limit,itemId);
  }
  adjustInventory(id:string,delta:number,reason:string,actor:string,metadata:RequestMetadata){
    return this.repository.adjustInventory(id,delta,reason,actor,{...metadata,actorUserId:actor,action:"inventory.adjusted",resourceType:"catalog_item"});
  }
}
function isUnique(error:unknown){return typeof error==="object"&&error!==null&&"code" in error&&error.code==="23505";}
