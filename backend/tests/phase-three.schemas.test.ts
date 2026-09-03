import{describe,expect,it}from"vitest";
import{invoiceCreateSchema,paymentCreateSchema}from"../src/modules/billing/billing.schemas";
import{catalogCreateSchema}from"../src/modules/catalog/catalog.schemas";
import{diagnosticOrderSchema}from"../src/modules/diagnostics/diagnostic.schemas";
import{prescriptionCreateSchema}from"../src/modules/pharmacy/pharmacy.schemas";
const id="91a7582a-2882-47bf-9398-ab283119285b";
describe("Phase 3 request invariants",()=>{
 it("allows inventory tracking only for drugs",()=>{expect(catalogCreateSchema.safeParse({itemType:"procedure",name:"Injection",price:10,trackInventory:true}).success).toBe(false);expect(catalogCreateSchema.safeParse({itemType:"drug",name:"Amoxicillin",price:10,trackInventory:true,openingQuantity:20}).success).toBe(true);});
 it("accepts lab panels with member tests",()=>{expect(catalogCreateSchema.safeParse({itemType:"lab_panel",name:"Antenatal panel",memberItemIds:["550e8400-e29b-41d4-a716-446655440000"]}).success).toBe(true);expect(catalogCreateSchema.safeParse({itemType:"lab_panel",name:"Empty panel",memberItemIds:[]}).success).toBe(false);});
 it("deduplicates diagnostic catalog selections",()=>{const parsed=diagnosticOrderSchema.parse({encounterId:id,catalogItemIds:[id,id]});expect(parsed.catalogItemIds).toEqual([id]);});
 it("requires approval context and cent precision for discounts",()=>{expect(invoiceCreateSchema.safeParse({visitId:id,discountAmount:5,items:[{catalogItemId:id,quantity:1}]}).success).toBe(false);expect(invoiceCreateSchema.safeParse({visitId:id,discountAmount:0.001,items:[{catalogItemId:id,quantity:1}]}).success).toBe(false);});
 it("rejects sub-cent payments",()=>{expect(paymentCreateSchema.safeParse({amount:10.001,method:"cash"}).success).toBe(false);});
 it("rejects duplicate drugs in one prescription",()=>{expect(prescriptionCreateSchema.safeParse({encounterId:id,items:[{catalogItemId:id,dosage:"1 tablet",frequency:"daily",duration:"5 days",quantity:5},{catalogItemId:id,dosage:"1 tablet",frequency:"daily",duration:"5 days",quantity:5}]}).success).toBe(false);});
});
