import type { Pool } from "pg";

export type BillableVisit = {
  id: string;
  visit_number: string;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  doctor_name: string | null;
  reason: string;
  priority: string;
  checked_in_at: Date;
};

export type SuggestedCharge = {
  catalog_item_id: string;
  description: string;
  quantity: string;
  item_type: string;
  unit_price: string;
};

export class CashierRepository {
  constructor(private readonly pool: Pool) {}

  async worklist(limit: number): Promise<BillableVisit[]> {
    const result = await this.pool.query<BillableVisit>(
      `select v.id,v.visit_number,v.patient_id,p.medical_record_number,
         concat_ws(' ',p.first_name,p.middle_name,p.last_name) as patient_name,
         d.full_name as doctor_name,v.reason,v.priority,v.checked_in_at
       from clinic.visits v
       join clinic.patients p on p.id=v.patient_id
       left join clinic.users d on d.id=v.doctor_id
       left join clinic.invoices i on i.visit_id=v.id
       where v.status='ready_for_billing' and i.id is null
       order by v.checked_in_at,v.id limit $1`,
      [limit],
    );
    return result.rows;
  }

  async suggestions(visitId: string): Promise<SuggestedCharge[]> {
    const result = await this.pool.query<SuggestedCharge>(
      `with suggested as (
         (select c.id as catalog_item_id,c.name as description,1::numeric as quantity,c.item_type,c.price
          from clinic.catalog_items c
          where c.item_type='consultation' and c.active=true
          order by c.created_at,c.id limit 1)
         union all
         select i.catalog_item_id,i.item_name,1::numeric,i.item_type,c.price
         from clinic.diagnostic_orders o
         join clinic.diagnostic_order_items i on i.diagnostic_order_id=o.id
         join clinic.catalog_items c on c.id=i.catalog_item_id
         where o.visit_id=$1 and o.status<>'cancelled' and i.status<>'cancelled'
         union all
         select i.catalog_item_id,i.drug_name,i.quantity_prescribed,'drug',c.price
         from clinic.prescriptions r
         join clinic.prescription_items i on i.prescription_id=r.id
         join clinic.catalog_items c on c.id=i.catalog_item_id
         where r.visit_id=$1 and r.status<>'cancelled'
       )
       select catalog_item_id,description,quantity::text,item_type,price::text as unit_price
       from suggested order by case item_type when 'consultation' then 1 when 'lab_test' then 2 when 'radiology' then 3 when 'drug' then 4 else 5 end,description`,
      [visitId],
    );
    return result.rows;
  }

  async isReadyForBilling(visitId: string): Promise<boolean> {
    const result = await this.pool.query("select 1 from clinic.visits where id=$1 and status='ready_for_billing'", [visitId]);
    return Boolean(result.rowCount);
  }
}
