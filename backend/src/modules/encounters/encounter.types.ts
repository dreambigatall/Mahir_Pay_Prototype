export type Encounter = {
  id: string;
  visit_id: string;
  visit_number: string;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  clinician_id: string;
  clinician_name: string;
  status: "open" | "signed";
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  diagnosis: string | null;
  started_at: Date;
  signed_at: Date | null;
  signed_by: string | null;
  updated_at: Date;
  amendments: EncounterAmendment[];
};

export type EncounterAmendment = {
  id: string;
  author_user_id: string;
  author_name: string;
  reason: string;
  content: string;
  created_at: Date;
};

export type EncounterDocument = {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnosis?: string;
};
