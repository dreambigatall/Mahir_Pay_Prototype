import { apiRequest } from "@/lib/api/client";

export type TreatmentCourseDto = Record<string, unknown> & { id: string; doses: Array<Record<string, unknown>> };

export function listTreatmentCourses(filters: { patientId?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.patientId) query.set("patientId", filters.patientId);
  if (filters.status) query.set("status", filters.status);
  return apiRequest<{ items: TreatmentCourseDto[] }>(`/treatment-courses?${query}`);
}

export function createTreatmentCourse(input: {
  patientId: string;
  catalogItemId: string;
  totalDoses: number;
  startDate: string;
  billingMode: "per_dose" | "package";
  notes?: string;
}) {
  return apiRequest<{ item: TreatmentCourseDto }>("/treatment-courses", { method: "POST", body: JSON.stringify(input) });
}

export function checkInTreatmentDose(courseId: string, doseId: string) {
  return apiRequest<{ item: TreatmentCourseDto }>(`/treatment-courses/${courseId}/doses/${doseId}/check-in`, { method: "POST" });
}

export function administerTreatmentDose(courseId: string, doseId: string, notes?: string) {
  return apiRequest<{ item: TreatmentCourseDto }>(`/treatment-courses/${courseId}/doses/${doseId}/administer`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

