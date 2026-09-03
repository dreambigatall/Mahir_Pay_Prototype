import type { Pool } from "pg";

export type TriageObservation = {
  id: string;
  visit_id: string;
  recorded_by: string;
  recorded_by_name: string;
  temperature_c: string | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  pulse_bpm: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: string | null;
  weight_kg: string | null;
  height_cm: string | null;
  pain_score: number | null;
  notes: string | null;
  recorded_at: Date;
  updated_at: Date;
};

export type DiagnosticOrder = {
  id: string;
  visit_id: string;
  encounter_id: string;
  patient_id: string;
  urgency: string;
  status: string;
  clinical_notes: string | null;
  ordered_by: string;
  ordered_at: Date;
  items: Array<Record<string, unknown>>;
};

export class ClinicalRepository {
  constructor(private readonly pool: Pool) {}

  async findTriage(visitId: string): Promise<TriageObservation | null> {
    const result = await this.pool.query<TriageObservation>(
      `select t.id,t.visit_id,t.recorded_by,u.full_name as recorded_by_name,
         t.temperature_c::text,t.systolic_bp,t.diastolic_bp,t.pulse_bpm,
         t.respiratory_rate,t.oxygen_saturation::text,t.weight_kg::text,
         t.height_cm::text,t.pain_score,t.notes,t.recorded_at,t.updated_at
       from clinic.triage_observations t
       join clinic.users u on u.id=t.recorded_by
       where t.visit_id=$1`,
      [visitId],
    );
    return result.rows[0] ?? null;
  }

  async findDiagnostics(visitId: string): Promise<DiagnosticOrder[]> {
    const result = await this.pool.query<DiagnosticOrder>(
      `select o.id,o.visit_id,o.encounter_id,o.patient_id,o.urgency,o.status,
         o.clinical_notes,o.ordered_by,o.ordered_at,
         coalesce((select jsonb_agg(jsonb_build_object(
           'id',i.id,'catalog_item_id',i.catalog_item_id,'item_name',i.item_name,
           'item_type',i.item_type,'status',i.status,'result',case when r.id is null then null else jsonb_build_object(
             'id',r.id,'result_value',r.result_value,'result_unit',r.result_unit,
             'result_flag',r.result_flag,'reference_range',r.reference_range,'notes',r.notes,
             'entered_at',r.entered_at,'verified_at',r.verified_at) end)
           order by i.created_at,i.id)
         from clinic.diagnostic_order_items i
         left join clinic.diagnostic_results r on r.diagnostic_order_item_id=i.id
         where i.diagnostic_order_id=o.id),'[]'::jsonb) as items
       from clinic.diagnostic_orders o
       where o.visit_id=$1
       order by o.ordered_at desc,o.id`,
      [visitId],
    );
    return result.rows;
  }

  async visitExists(visitId: string): Promise<boolean> {
    const result = await this.pool.query("select 1 from clinic.visits where id=$1", [visitId]);
    return Boolean(result.rowCount);
  }
}
