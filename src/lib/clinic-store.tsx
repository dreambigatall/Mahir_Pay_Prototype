"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { catalog as seedCatalog, labRequests as seedLabRequests, visits as seedVisits } from "@/lib/mock-data";
import type { CatalogItem, CatalogType, LabRequest, LabResultFlag, LabUrgency, Visit } from "@/lib/types";

const STORAGE_KEY = "ridgeway-cms-clinic-data-v3";

type ClinicState = {
  catalog: CatalogItem[];
  labRequests: LabRequest[];
  visits: Visit[];
};

type OrderLabsInput = {
  visitId: string;
  doctorId: string;
  catalogItemIds: string[];
  urgency: LabUrgency;
  clinicalNotes: string;
};

type ClinicContextValue = ClinicState & {
  ready: boolean;
  labTests: CatalogItem[];
  addLabTest: (input: { name: string; price: number }) => void;
  setLabTestActive: (id: string, active: boolean) => void;
  addCatalogItem: (input: { type: CatalogType; name: string; price: number }) => void;
  updateCatalogItem: (
    id: string,
    patch: { name?: string; price?: number; type?: CatalogType; active?: boolean },
  ) => void;
  deleteCatalogItem: (id: string) => void;
  orderLabs: (input: OrderLabsInput) => LabRequest[];
  markVisitLabsInProgress: (visitId: string) => void;
  submitVisitLabResults: (
    visitId: string,
    results: Record<
      string,
      {
        resultValue: string;
        resultUnit: string;
        resultFlag: LabResultFlag;
        resultNotes: string;
      }
    >,
  ) => void;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

function uniquePendingLabs(requests: LabRequest[]) {
  const pending = new Map<string, LabRequest>();
  const completed: LabRequest[] = [];
  for (const request of requests) {
    if (request.status === "result-ready") {
      completed.push(request);
      continue;
    }
    pending.set(`${request.visitId}:${request.catalogItemId}`, request);
  }
  return [...pending.values(), ...completed];
}

function mergeCatalog(stored: CatalogItem[] | undefined): CatalogItem[] {
  const byId = new Map(seedCatalog.map((item) => [item.id, item]));
  for (const item of stored ?? []) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClinicState>({
    catalog: seedCatalog,
    labRequests: seedLabRequests,
    visits: seedVisits,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClinicState>;
        setState({
          catalog: mergeCatalog(parsed.catalog),
          labRequests: parsed.labRequests?.length ? parsed.labRequests : seedLabRequests,
          visits: parsed.visits?.length ? parsed.visits : seedVisits,
        });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const value = useMemo<ClinicContextValue>(() => {
    const labTests = state.catalog
      .filter((item) => item.type === "lab_test")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...state,
      ready,
      labTests,
      addCatalogItem: ({ type, name, price }) => {
        const prefix = type === "lab_test" ? "lab" : type === "drug" ? "drug" : "svc";
        const item: CatalogItem = {
          id: `${prefix}-${Date.now()}`,
          type,
          name: name.trim(),
          price,
          active: true,
        };
        setState((current) => ({ ...current, catalog: [item, ...current.catalog] }));
      },
      updateCatalogItem: (id, patch) => {
        setState((current) => ({
          ...current,
          catalog: current.catalog.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                  ...(patch.price !== undefined ? { price: patch.price } : {}),
                  ...(patch.type !== undefined ? { type: patch.type } : {}),
                  ...(patch.active !== undefined ? { active: patch.active } : {}),
                }
              : item,
          ),
        }));
      },
      deleteCatalogItem: (id) => {
        setState((current) => ({
          ...current,
          catalog: current.catalog.filter((item) => item.id !== id),
        }));
      },
      addLabTest: ({ name, price }) => {
        const item: CatalogItem = {
          id: `lab-${Date.now()}`,
          type: "lab_test",
          name: name.trim(),
          price,
          active: true,
        };
        setState((current) => ({ ...current, catalog: [item, ...current.catalog] }));
      },
      setLabTestActive: (id, active) => {
        setState((current) => ({
          ...current,
          catalog: current.catalog.map((item) =>
            item.id === id ? { ...item, active } : item,
          ),
        }));
      },
      orderLabs: ({ visitId, doctorId, catalogItemIds, urgency, clinicalNotes }) => {
        const pendingIds = new Set(
          state.labRequests
            .filter(
              (request) =>
                request.visitId === visitId && request.status !== "result-ready",
            )
            .map((request) => request.catalogItemId),
        );
        const created: LabRequest[] = [];
        for (const catalogItemId of catalogItemIds) {
          if (pendingIds.has(catalogItemId)) continue;
          const test = state.catalog.find((item) => item.id === catalogItemId);
          if (!test || !test.active || test.type !== "lab_test") continue;
          created.push({
            id: `lab-${visitId}-${catalogItemId}-${Date.now()}`,
            visitId,
            doctorId,
            catalogItemId: test.id,
            testName: test.name,
            urgency,
            status: "requested",
            clinicalNotes: clinicalNotes.trim(),
          });
        }
        if (created.length > 0) {
          setState((current) => ({
            ...current,
            labRequests: uniquePendingLabs([...created, ...current.labRequests]),
            visits: current.visits.map((visit) =>
              visit.id === visitId &&
              (visit.status === "registered" || visit.status === "in-consultation")
                ? { ...visit, status: "awaiting-lab" }
                : visit,
            ),
          }));
        }
        return created;
      },
      markVisitLabsInProgress: (visitId) => {
        setState((current) => {
          const needsUpdate = current.labRequests.some(
            (request) => request.visitId === visitId && request.status === "requested",
          );
          if (!needsUpdate) return current;
          return {
            ...current,
            labRequests: current.labRequests.map((request) =>
              request.visitId === visitId && request.status === "requested"
                ? { ...request, status: "in-progress" }
                : request,
            ),
          };
        });
      },
      submitVisitLabResults: (visitId, results) => {
        setState((current) => {
          const labRequests = current.labRequests.map((request) => {
            if (request.visitId !== visitId) return request;
            const result = results[request.id];
            if (!result) return request;
            return {
              ...request,
              status: "result-ready" as const,
              resultValue: result.resultValue.trim(),
              resultUnit: result.resultUnit.trim(),
              resultFlag: result.resultFlag,
              resultNotes: result.resultNotes.trim(),
            };
          });
          const visitDone = labRequests
            .filter((request) => request.visitId === visitId)
            .every((request) => request.status === "result-ready");
          return {
            ...current,
            labRequests,
            visits: current.visits.map((visit) =>
              visit.id === visitId && visitDone
                ? { ...visit, status: "lab-complete" }
                : visit,
            ),
          };
        });
      },
    };
  }, [ready, state]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error("useClinic must be used within ClinicProvider");
  return context;
}
