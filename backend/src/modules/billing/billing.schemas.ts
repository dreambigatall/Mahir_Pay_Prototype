import{z}from"zod";
const money=z.number().nonnegative().max(999999999).multipleOf(0.01);
export const invoiceCreateSchema=z.object({visitId:z.string().uuid(),discountAmount:money.default(0),discountReason:z.string().trim().min(1).max(1000).optional(),items:z.array(z.object({catalogItemId:z.string().uuid(),quantity:z.number().positive().max(999999).multipleOf(0.001),description:z.string().trim().min(1).max(500).optional()})).min(1).max(100)}).superRefine((v,c)=>{if(v.discountAmount>0&&!v.discountReason)c.addIssue({code:"custom",path:["discountReason"],message:"Discount reason is required"});});
export const paymentCreateSchema=z.object({amount:money.refine(v=>v>0,{message:"Payment must be greater than zero"}),method:z.enum(["cash","card","mobile_money","bank_transfer","credit"]),reference:z.string().trim().min(1).max(200).optional()});
export const creditAuthorizeSchema=z.object({
  dueAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,{message:"Due date must be YYYY-MM-DD"}),
  note:z.string().trim().min(1).max(1000).optional(),
});
