import { apiRequest } from "@/lib/api/client";

export type PrescriptionItem = {
  id: string;
  catalog_item_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  quantity_prescribed: number | string;
  quantity_dispensed: number | string;
  unit_price: number | string;
};

export type PharmacyPrescription = {
  id: string;
  visit_id: string;
  encounter_id: string;
  patient_id: string;
  visit_number: string;
  patient_name: string;
  prescriber_id: string;
  prescriber_name: string;
  status: "awaiting_payment" | "payment_approved" | "partially_dispensed" | "dispensed" | string;
  notes: string | null;
  prescribed_at: string;
  items: PrescriptionItem[];
};

export function listPharmacyWorklist(signal?: AbortSignal) {
  return apiRequest<{ items: PharmacyPrescription[] }>("/pharmacy/worklist?limit=200", { signal });
}

export function getPharmacyPrescription(prescriptionId: string, signal?: AbortSignal) {
  return apiRequest<{ item: PharmacyPrescription }>(`/pharmacy/prescriptions/${prescriptionId}`, { signal });
}

export function dispensePrescription(
  prescriptionId: string,
  items: Array<{ prescriptionItemId: string; quantity: number }>,
  notes?: string,
) {
  return apiRequest<{ item: PharmacyPrescription }>(`/pharmacy/prescriptions/${prescriptionId}/dispense`, {
    method: "POST",
    body: JSON.stringify({ items, notes }),
  });
}
