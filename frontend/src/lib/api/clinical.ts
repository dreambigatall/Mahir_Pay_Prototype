import { apiRequest } from "@/lib/api/client";

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
  recorded_at: string;
  updated_at: string;
};

export type CatalogItem = {
  id: string;
  item_code: string;
  item_type: "consultation" | "lab_test" | "radiology" | "drug" | "procedure" | "lab_panel" | "supply";
  name: string;
  description: string | null;
  unit: string | null;
  price: string;
  /** How the lab records this test's result; parse with `parseResultSetup`. */
  result_setup?: unknown;
  track_inventory: boolean;
  supply_group_id: string | null;
  supply_group_name: string | null;
  active: boolean;
  quantity_on_hand: string | null;
  reorder_level: string | null;
  usable_quantity: string | null;
  next_expiry: string | null;
  suggested_order_quantity: string | null;
};

export type PanelMember = {
  id: string;
  item_code: string;
  name: string;
  item_type: "lab_test" | "radiology";
  price: string;
};

export type LabPanel = CatalogItem & { members: PanelMember[] };

export type DiagnosticResult = {
  id: string;
  result_value: string;
  result_unit: string | null;
  result_flag: "normal" | "abnormal" | "critical" | null;
  reference_range: string | null;
  notes: string | null;
  entered_at: string;
  verified_at: string | null;
};

export type DiagnosticItem = {
  id: string;
  catalog_item_id: string;
  item_name: string;
  item_type: "lab_test" | "radiology";
  status: string;
  /** The test's current result setup from the catalog; parse with `parseResultSetup`. */
  result_setup?: unknown;
  result: DiagnosticResult | null;
};

export type DiagnosticOrder = {
  id: string;
  visit_id: string;
  encounter_id: string;
  urgency: "routine" | "urgent";
  status: string;
  clinical_notes: string | null;
  ordered_at: string;
  items: DiagnosticItem[];
};

export type PrescriptionItem = {
  id: string;
  catalog_item_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  quantity_prescribed: string;
  quantity_dispensed: string;
  unit_price: string;
};

export type Prescription = {
  id: string;
  visit_id: string;
  encounter_id: string;
  status: string;
  notes: string | null;
  prescribed_at: string;
  items: PrescriptionItem[];
};

export function getTriage(visitId: string, signal?: AbortSignal) {
  return apiRequest<{ item: TriageObservation }>(`/clinical/visits/${visitId}/triage`, { signal });
}

export function getVisitDiagnostics(visitId: string) {
  return apiRequest<{ items: DiagnosticOrder[] }>(`/clinical/visits/${visitId}/diagnostics`);
}

export function listCatalog(type: CatalogItem["item_type"]) {
  return apiRequest<{ items: CatalogItem[] }>(`/catalog?type=${type}&limit=200`);
}

export function listLabPanels() {
  return apiRequest<{ items: LabPanel[] }>("/catalog/panels?limit=200");
}

export function createDiagnosticOrder(input: { encounterId: string; catalogItemIds: string[]; urgency: "routine" | "urgent"; clinicalNotes?: string }) {
  return apiRequest<{ item: DiagnosticOrder }>("/diagnostics/orders", { method: "POST", body: JSON.stringify(input) });
}

export function reviewDiagnosticOrder(orderId: string) {
  return apiRequest<{ item: DiagnosticOrder }>(`/diagnostics/orders/${orderId}/review`, { method: "POST" });
}

export function cancelDiagnosticOrder(orderId: string, reason?: string) {
  return apiRequest<{ item: DiagnosticOrder }>(`/diagnostics/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function cancelDiagnosticOrderItem(itemId: string, reason?: string) {
  return apiRequest<{ item: DiagnosticOrder }>(`/diagnostics/items/${itemId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function updateDiagnosticOrder(orderId: string, input: { urgency?: "routine" | "urgent"; clinicalNotes?: string | null }) {
  return apiRequest<{ item: DiagnosticOrder }>(`/diagnostics/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getVisitPrescriptions(visitId: string) {
  return apiRequest<{ items: Prescription[] }>(`/pharmacy/prescriptions/by-visit/${visitId}`);
}

export function createPrescription(input: { encounterId: string; notes?: string; items: Array<{ catalogItemId: string; dosage: string; frequency: string; duration: string; instructions?: string; quantity: number }> }) {
  return apiRequest<{ item: Prescription }>("/pharmacy/prescriptions", { method: "POST", body: JSON.stringify(input) });
}

