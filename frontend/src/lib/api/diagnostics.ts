import { apiRequest } from "@/lib/api/client";
import type { DiagnosticOrder } from "@/lib/api/clinical";

export type WorklistDiagnosticOrder = DiagnosticOrder & {
  patient_id: string;
  patient_name: string;
  visit_number: string;
  ordered_by: string;
};

export function listDiagnosticWorklist(signal?: AbortSignal) {
  return apiRequest<{ items: WorklistDiagnosticOrder[] }>("/diagnostics/orders?limit=200&includeReviewed=true", { signal });
}

export function getDiagnosticOrder(orderId: string, signal?: AbortSignal) {
  return apiRequest<{ item: WorklistDiagnosticOrder }>(`/diagnostics/orders/${orderId}`, { signal });
}

export function startDiagnosticOrder(orderId: string) {
  return apiRequest<{ item: WorklistDiagnosticOrder }>(`/diagnostics/orders/${orderId}/start`, { method: "POST" });
}

export function enterDiagnosticResult(itemId: string, input: { resultValue: string; resultUnit?: string; resultFlag?: "normal" | "abnormal" | "critical"; referenceRange?: string; notes?: string }) {
  return apiRequest<{ item: WorklistDiagnosticOrder }>(`/diagnostics/items/${itemId}/result`, { method: "PUT", body: JSON.stringify(input) });
}

export function verifyDiagnosticResult(itemId: string) {
  return apiRequest<{ item: WorklistDiagnosticOrder }>(`/diagnostics/items/${itemId}/verify`, { method: "POST" });
}
