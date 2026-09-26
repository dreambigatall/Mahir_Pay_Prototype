import type { LabStatus, VisitStatus } from "@/lib/types";

type ChipVariant = "default" | "secondary" | "outline" | "ghost" | "danger" | "warning" | "success" | "clinical" | "neutral" | "info";

export function mapBackendVisitStatus(status: string): VisitStatus {
  switch (status) {
    case "registered":
    case "awaiting_triage":
    case "awaiting_doctor":
      return "registered";
    case "in_consultation":
      return "in-consultation";
    case "awaiting_lab":
      return "awaiting-lab";
    case "lab_complete":
      return "lab-complete";
    case "medication_prescribed":
      return "medication-prescribed";
    case "ready_for_billing":
      return "ready-for-billing";
    case "billed":
    case "completed":
      return "billed";
    case "cancelled":
      return "cancelled";
    default:
      return "registered";
  }
}

/** Doctor treats these backend statuses as completed — clinical handoff, not payment. */
const DOCTOR_COMPLETE_BACKEND_STATUSES = [
  "ready_for_billing",
  "medication_prescribed",
  "billed",
  "completed",
] as const;

export function isDoctorClinicalComplete(status: string): boolean {
  return (DOCTOR_COMPLETE_BACKEND_STATUSES as readonly string[]).includes(status)
    || status === "ready-for-billing"
    || status === "medication-prescribed";
}

export function mapDoctorVisitStatus(status: string): VisitStatus {
  if (isDoctorClinicalComplete(status)) {
    return "billed";
  }
  return mapBackendVisitStatus(status);
}

export function doctorVisitBadge(status: string): { role: ChipVariant; label: string } {
  if (isDoctorClinicalComplete(status)) {
    return { role: "success", label: "Completed" };
  }
  return visitBadge(mapBackendVisitStatus(status));
}

export const QUEUE_COLUMNS = [
  { id: "registered", title: "Checked in", statuses: ["registered"] as VisitStatus[] },
  {
    id: "in-consultation",
    title: "In consultation",
    statuses: ["in-consultation"] as VisitStatus[],
  },
  {
    id: "awaiting-lab",
    title: "Awaiting lab",
    statuses: ["awaiting-lab", "lab-complete"] as VisitStatus[],
  },
  {
    id: "ready-for-billing",
    title: "Ready for billing",
    statuses: ["medication-prescribed", "ready-for-billing"] as VisitStatus[],
  },
  { id: "completed", title: "Completed", statuses: ["billed"] as VisitStatus[] },
] as const;

export const DOCTOR_QUEUE_COLUMNS = [
  {
    id: "registered",
    title: "Waiting for me",
    description: "Checked in · not seen yet",
    statuses: ["registered"] as VisitStatus[],
  },
  {
    id: "in-consultation",
    title: "In consultation",
    description: "Currently with me",
    statuses: ["in-consultation"] as VisitStatus[],
  },
  {
    id: "awaiting-lab",
    title: "Lab tests",
    description: "Waiting for results, or results back",
    statuses: ["awaiting-lab", "lab-complete"] as VisitStatus[],
  },
  {
    id: "completed",
    title: "Completed",
    description: "My part is finished",
    statuses: ["billed"] as VisitStatus[],
  },
] as const;

export const LAB_COLUMNS = [
  { id: "requested", title: "Requested", statuses: ["requested"] as LabStatus[] },
  { id: "in-progress", title: "In progress", statuses: ["in-progress"] as LabStatus[] },
  { id: "result-ready", title: "Result ready", statuses: ["result-ready"] as LabStatus[] },
] as const;

export function visitBadge(status: VisitStatus): { role: ChipVariant; label: string } {
  switch (status) {
    case "registered":
      return { role: "neutral", label: "In queue" };
    case "in-consultation":
      return { role: "clinical", label: "In consultation" };
    case "awaiting-lab":
      return { role: "warning", label: "Awaiting lab" };
    case "lab-complete":
      return { role: "clinical", label: "Lab complete" };
    case "medication-prescribed":
    case "ready-for-billing":
      return { role: "warning", label: "Ready for billing" };
    case "clinical-complete":
      return { role: "success", label: "Done" };
    case "billed":
      return { role: "success", label: "Completed" };
    case "cancelled":
      return { role: "danger", label: "Cancelled" };
  }
}

export function visitDot(status: VisitStatus) {
  switch (status) {
    case "in-consultation":
      return "bg-clinical-fill";
    case "awaiting-lab":
    case "lab-complete":
    case "medication-prescribed":
    case "ready-for-billing":
      return "bg-warning-fill";
    case "clinical-complete":
    case "billed":
      return "bg-success-fill";
    case "cancelled":
      return "bg-danger-fill";
    default:
      return "bg-neutral-fill";
  }
}

export function labBadge(status: LabStatus): { role: ChipVariant; label: string } {
  switch (status) {
    case "requested":
      return { role: "neutral", label: "Requested" };
    case "in-progress":
      return { role: "clinical", label: "In progress" };
    case "result-ready":
      return { role: "success", label: "Result ready" };
    case "reviewed":
      return { role: "success", label: "Reviewed" };
  }
}
