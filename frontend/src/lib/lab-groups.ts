import type { LabRequest, LabStatus } from "@/lib/types";

export type LabVisitGroup = {
  visitId: string;
  doctorId: string;
  requests: LabRequest[];
  status: LabStatus;
  testCount: number;
  urgent: boolean;
};

export function labGroupStatus(requests: LabRequest[]): LabStatus {
  if (requests.length === 0) return "requested";
  if (requests.every((request) => request.status === "result-ready")) {
    return "result-ready";
  }
  if (requests.every((request) => request.status === "requested")) {
    return "requested";
  }
  return "in-progress";
}

export function groupLabsByVisit(requests: LabRequest[]): LabVisitGroup[] {
  const groups = new Map<string, LabRequest[]>();
  for (const request of requests) {
    const list = groups.get(request.visitId) ?? [];
    list.push(request);
    groups.set(request.visitId, list);
  }

  return [...groups.entries()].map(([visitId, items]) => ({
    visitId,
    doctorId: items[0]?.doctorId ?? "",
    requests: items,
    status: labGroupStatus(items),
    testCount: items.length,
    urgent: items.some((item) => item.urgency === "urgent"),
  }));
}
