export type VisitPriority = "routine" | "urgent" | "emergency";
export type QueueStation = "triage" | "doctor" | "lab" | "pharmacy" | "billing" | "procedure";
export type QueueStatus = "waiting" | "called" | "in_service" | "completed" | "cancelled";

export type Appointment = {
  id: string;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  scheduled_at: Date;
  duration_minutes: number;
  reason: string;
  status: string;
  notes: string | null;
  created_at: Date;
};

export type Visit = {
  id: string;
  visit_number: string;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  appointment_id: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  kind: "consultation" | "procedure";
  reason: string;
  status: string;
  priority: VisitPriority;
  checked_in_at: Date;
  completed_at: Date | null;
  active_queue: QueueEntry | null;
};

export type VisitBoardItem = Visit & {
  patient_date_of_birth: string;
  patient_sex: string;
  wait_minutes: number;
};

export type QueueEntry = {
  id: string;
  visit_id: string;
  visit_number: string;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  station: QueueStation;
  status: QueueStatus;
  priority: VisitPriority;
  assigned_user_id: string | null;
  queued_at: Date;
  called_at: Date | null;
  service_started_at: Date | null;
  wait_minutes: number;
};

export type TriageWrite = {
  temperatureC?: number;
  systolicBp?: number;
  diastolicBp?: number;
  pulseBpm?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  painScore?: number;
  notes?: string;
};
