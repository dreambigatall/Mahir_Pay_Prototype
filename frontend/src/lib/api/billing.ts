import { apiRequest } from "@/lib/api/client";

export type BillableVisit = { id: string; visit_number: string; patient_id: string; medical_record_number: string; patient_name: string; doctor_name: string | null; reason: string; priority: string; checked_in_at: string; pending_rx_count?: number; pending_rx_summary?: string | null };
export type SuggestedCharge = { catalog_item_id: string; description: string; quantity: string; item_type: string; unit_price: string };
export type InvoiceLine = { id: string; catalog_item_id: string; line_type: string; description: string; quantity: string; unit_price: string; line_total: string };
export type Payment = { id: string; receipt_number: string; amount: string; method: string; reference: string | null; status: string; paid_at: string };
export type BackendInvoice = { id: string; invoice_number: string; visit_id: string; patient_id: string; visit_number: string; patient_name: string; status: "issued" | "partially_paid" | "paid" | "void"; subtotal: string; discount_amount: string; total: string; amount_paid: string; balance_due: string; discount_reason: string | null; issued_at: string; paid_at: string | null; pending_rx_count?: number; pending_rx_summary?: string | null; lines: InvoiceLine[]; payments: Payment[] };

export function listBillableVisits(signal?: AbortSignal) { return apiRequest<{ items: BillableVisit[] }>("/billing/worklist?limit=200", { signal }); }
export function listOutstandingInvoices(signal?: AbortSignal) { return apiRequest<{ items: BackendInvoice[] }>("/billing/invoices/outstanding?limit=200", { signal }); }
export function listPaidInvoicesToday(signal?: AbortSignal) { return apiRequest<{ items: BackendInvoice[] }>("/billing/invoices/paid-today?limit=200", { signal }); }
export function getChargeSuggestions(visitId: string) { return apiRequest<{ items: SuggestedCharge[] }>(`/billing/suggestions/${visitId}`); }
export function getInvoiceByVisit(visitId: string) { return apiRequest<{ item: BackendInvoice }>(`/billing/invoices/by-visit/${visitId}`); }
export function issueInvoice(visitId: string, items: Array<{ catalogItemId: string; quantity: number; description?: string }>) { return apiRequest<{ item: BackendInvoice }>("/billing/invoices", { method: "POST", body: JSON.stringify({ visitId, discountAmount: 0, items }) }); }
export function collectInvoicePayment(invoiceId: string, input: { amount: number; method: "cash" | "card" | "mobile_money" | "bank_transfer" | "credit"; reference?: string }) { return apiRequest<{ item: BackendInvoice }>(`/billing/invoices/${invoiceId}/payments`, { method: "POST", body: JSON.stringify(input) }); }
