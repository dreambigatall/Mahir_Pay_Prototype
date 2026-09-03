import { apiRequest } from "@/lib/api/client";

export type QueueStation = "triage" | "doctor" | "lab" | "pharmacy" | "billing" | "procedure";
export type QueueStatus = "waiting" | "called" | "in_service";
export type VisitPriority = "routine" | "urgent" | "emergency";

export type BackendQueueEntry = {
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
  queued_at: string;
  called_at: string | null;
  service_started_at: string | null;
  wait_minutes: number;
};

export type BackendVisit = {
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
  checked_in_at: string;
  completed_at: string | null;
  active_queue: BackendQueueEntry | null;
};

export type BackendVisitBoardItem = BackendVisit & {
  patient_date_of_birth: string;
  patient_sex: string;
  wait_minutes: number;
};

export function listDoctorVisits(options?: { doctorId?: string; scope?: "today" | "all"; signal?: AbortSignal }) {
  const query = new URLSearchParams();
  if (options?.doctorId) query.set("doctorId", options.doctorId);
  if (options?.scope) query.set("scope", options.scope);
  query.set("limit", options?.scope === "all" ? "200" : "100");
  return apiRequest<{ items: BackendVisitBoardItem[] }>(`/visits?${query}`, { signal: options?.signal });
}

export function checkInPatient(input: {
  patientId: string;
  doctorId?: string;
  kind?: "consultation" | "procedure";
  reason: string;
  priority?: VisitPriority;
}) {
  return apiRequest<{ item: BackendVisit }>("/visits/check-in", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getActiveVisitByPatient(patientId: string, signal?: AbortSignal) {
  return apiRequest<{ item: BackendVisit | null }>(`/visits/active-by-patient/${patientId}`, { signal });
}

export function assignVisitDoctor(visitId: string, doctorId: string | null) {
  return apiRequest<{ item: BackendVisit }>(`/visits/${visitId}/doctor`, {
    method: "PATCH",
    body: JSON.stringify({ doctorId }),
  });
}

export function sendVisitToDoctor(visitId: string) {
  return apiRequest<{ item: BackendVisit }>(`/visits/${visitId}/send-to-doctor`, {
    method: "POST",
  });
}

export type VitalsWrite = {
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

export function saveVisitVitals(visitId: string, vitals: VitalsWrite) {
  return apiRequest<{ item: BackendVisit }>(`/visits/${visitId}/vitals`, {
    method: "PUT",
    body: JSON.stringify(vitals),
  });
}

export function listQueue(station: QueueStation, signal?: AbortSignal) {
  const query = new URLSearchParams({ station, limit: "100" });
  return apiRequest<{ items: BackendQueueEntry[] }>(`/queue?${query}`, { signal });
}
