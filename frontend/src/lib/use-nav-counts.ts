"use client";

import { useEffect, useState } from "react";

import { listBillableVisits } from "@/lib/api/billing";
import { listDiagnosticWorklist } from "@/lib/api/diagnostics";
import { listPharmacyWorklist } from "@/lib/api/pharmacy";
import { listDoctorVisits, listQueue } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import type { Role } from "@/lib/types";
import { mapDoctorVisitStatus } from "@/lib/visit-status";

/** Live "needs your attention" counts shown as sidebar badges, keyed by nav href. */
export type NavCounts = Partial<Record<string, number>>;

const REFRESH_MS = 60_000;

async function countsFor(role: Role, userId: string, signal: AbortSignal): Promise<NavCounts> {
  switch (role) {
    case "receptionist": {
      const [triage, billable] = await Promise.all([listQueue("triage", signal), listBillableVisits(signal)]);
      return {
        "/receptionist": triage.items.filter((entry) => entry.status === "waiting").length,
        "/receptionist/billing": billable.items.length,
      };
    }
    case "doctor": {
      const { items } = await listDoctorVisits({ doctorId: userId, scope: "today", signal });
      const needsMe = items.filter((visit) =>
        ["registered", "in-consultation", "lab-complete"].includes(mapDoctorVisitStatus(visit.status)),
      );
      return { "/doctor": needsMe.length };
    }
    case "lab": {
      const { items } = await listDiagnosticWorklist(signal);
      return { "/lab": items.filter((order) => ["requested", "in_progress", "result_ready"].includes(order.status)).length };
    }
    case "pharmacist": {
      const { items } = await listPharmacyWorklist(signal);
      return { "/pharmacy": items.filter((rx) => rx.status === "payment_approved" || rx.status === "partially_dispensed").length };
    }
    default:
      return {};
  }
}

export function useNavCounts(role: Role | undefined, userId: string | undefined): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({});

  useEffect(() => {
    if (!role || !userId) return;
    let controller = new AbortController();

    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      const { signal } = controller;
      countsFor(role, userId, signal)
        .then((next) => { if (!signal.aborted) setCounts(next); })
        .catch(() => { /* badges are a convenience; keep the last known counts */ });
    };

    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    };
  }, [role, userId]);

  return counts;
}
