import { apiRequest } from "@/lib/api/client";

export function getDashboardReport() {
  return apiRequest<{ item: Record<string, number> }>("/reports/dashboard");
}

export function getPeriodReport(from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return apiRequest<{ item: Record<string, unknown> }>(`/reports/period?${query}`);
}

