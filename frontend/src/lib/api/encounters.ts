import { apiRequest } from "@/lib/api/client";
import type { BackendPatient } from "@/lib/api/patients";
import type { BackendVisit } from "@/lib/api/workflow";

export type EncounterAmendment = {
  id: string;
  author_user_id: string;
  author_name: string;
  reason: string;
  content: string;
  created_at: string;
};

export type BackendEncounter = {
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
  started_at: string;
  signed_at: string | null;
  signed_by: string | null;
  updated_at: string;
  amendments: EncounterAmendment[];
};

export type EncounterDocument = {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnosis?: string;
};

export function getVisit(visitId: string, signal?: AbortSignal) {
  return apiRequest<{ item: BackendVisit }>(`/visits/${visitId}`, { signal });
}

export function getPatient(patientId: string, signal?: AbortSignal) {
  return apiRequest<{ item: BackendPatient }>(`/patients/${patientId}`, { signal });
}

export function getEncounterByVisit(visitId: string, signal?: AbortSignal) {
  return apiRequest<{ item: BackendEncounter }>(`/encounters/by-visit/${visitId}`, { signal });
}

export function startEncounter(visitId: string, signal?: AbortSignal) {
  return apiRequest<{ item: BackendEncounter }>("/encounters", {
    method: "POST",
    body: JSON.stringify({ visitId }),
    signal,
  });
}

export function saveEncounter(encounterId: string, document: EncounterDocument) {
  return apiRequest<{ item: BackendEncounter }>(`/encounters/${encounterId}`, {
    method: "PATCH",
    body: JSON.stringify(document),
  });
}

export function signEncounter(encounterId: string) {
  return apiRequest<{ item: BackendEncounter }>(`/encounters/${encounterId}/sign`, {
    method: "POST",
  });
}

export function addEncounterAmendment(encounterId: string, reason: string, content: string) {
  return apiRequest<{ item: BackendEncounter }>(`/encounters/${encounterId}/amendments`, {
    method: "POST",
    body: JSON.stringify({ reason, content }),
  });
}
