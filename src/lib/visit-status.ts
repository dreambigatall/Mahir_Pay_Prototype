import type { StatusRole } from "@/components/ui/status-badge";
import type { LabStatus, VisitStatus } from "@/lib/types";

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

export const LAB_COLUMNS = [
  { id: "requested", title: "Requested", statuses: ["requested"] as LabStatus[] },
  { id: "in-progress", title: "In progress", statuses: ["in-progress"] as LabStatus[] },
  { id: "result-ready", title: "Result ready", statuses: ["result-ready"] as LabStatus[] },
] as const;

export function visitBadge(status: VisitStatus): { role: StatusRole; label: string } {
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
    case "billed":
      return "bg-success-fill";
    case "cancelled":
      return "bg-danger-fill";
    default:
      return "bg-neutral-fill";
  }
}

export function labBadge(status: LabStatus): { role: StatusRole; label: string } {
  switch (status) {
    case "requested":
      return { role: "neutral", label: "Requested" };
    case "in-progress":
      return { role: "clinical", label: "In progress" };
    case "result-ready":
      return { role: "success", label: "Result ready" };
  }
}
