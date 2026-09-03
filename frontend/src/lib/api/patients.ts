import { apiRequest } from "@/lib/api/client";

export type BackendPatient = {
  id: string;
  medical_record_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: "female" | "male" | "intersex" | "unknown";
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  blood_group: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  allergies: Array<{
    id: string;
    allergen: string;
    reaction: string | null;
    severity: "mild" | "moderate" | "severe" | null;
    recorded_at: string;
  }>;
};

export type PatientWrite = {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  sex: BackendPatient["sex"];
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  allergies: Array<{
    allergen: string;
    reaction?: string;
    severity?: "mild" | "moderate" | "severe";
  }>;
};

export function listPatients(options: { search?: string; limit?: number; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 100) });
  if (options.search?.trim()) query.set("search", options.search.trim());
  return apiRequest<{ items: BackendPatient[]; nextCursor: string | null }>(`/patients?${query}`, {
    signal: options.signal,
  });
}

export function createPatient(input: PatientWrite) {
  return apiRequest<{ item: BackendPatient }>("/patients", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePatient(patientId: string, input: PatientWrite) {
  return apiRequest<{ item: BackendPatient }>(`/patients/${patientId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
