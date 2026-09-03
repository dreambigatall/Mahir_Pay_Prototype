import { apiRequest } from "@/lib/api/client";

export type ReferralDto = Record<string, unknown> & { id: string; status: string };

export function listReferrals(filters: { patientId?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.patientId) query.set("patientId", filters.patientId);
  if (filters.status) query.set("status", filters.status);
  return apiRequest<{ items: ReferralDto[] }>(`/referrals?${query}`);
}

export function createReferral(input: Record<string, unknown>) {
  return apiRequest<{ item: ReferralDto }>("/referrals", { method: "POST", body: JSON.stringify(input) });
}

export function updateReferralStatus(id: string, status: string, reason?: string) {
  return apiRequest<{ item: ReferralDto }>(`/referrals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

