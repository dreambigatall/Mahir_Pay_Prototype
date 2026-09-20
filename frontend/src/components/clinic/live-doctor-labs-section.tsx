"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FlaskConical, Loader2, RefreshCw } from "lucide-react";

import { LiveDoctorLabResults } from "@/components/clinic/live-doctor-lab-results";
import { LiveOrderLabDialog } from "@/components/clinic/live-order-lab-dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ApiError } from "@/lib/api/client";
import {
  getVisitDiagnostics,
  listCatalog,
  listLabPanels,
  type CatalogItem,
  type DiagnosticOrder,
  type LabPanel,
} from "@/lib/api/clinical";

export function LiveDoctorLabsSection({
  visitId,
  encounterId,
  readOnly,
}: {
  visitId: string;
  encounterId: string;
  readOnly: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [labs, imaging, panelResponse, diagnosticResponse] = await Promise.all([
        listCatalog("lab_test"),
        listCatalog("radiology"),
        listLabPanels(),
        getVisitDiagnostics(visitId),
      ]);
      setCatalog([...labs.items, ...imaging.items]);
      setPanels(panelResponse.items.filter((panel) => panel.active && panel.members.length > 0));
      setOrders(diagnosticResponse.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Laboratory orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCatalogItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const order of orders) {
      if (order.status === "reviewed" || order.status === "cancelled") continue;
      for (const item of order.items) {
        if (!["reviewed", "cancelled"].includes(item.status)) {
          ids.add(item.catalog_item_id);
        }
      }
    }
    return ids;
  }, [orders]);

  const activeItems = useMemo(
    () =>
      orders
        .filter((order) => order.status !== "cancelled")
        .flatMap((order) => order.items.filter((item) => item.status !== "cancelled")),
    [orders],
  );
  const readyCount = activeItems.filter(
    (item) => item.result?.result_value && ["result_ready", "verified", "reviewed"].includes(item.status),
  ).length;
  const allReady = activeItems.length > 0 && readyCount === activeItems.length;
  const isEmpty = !loading && activeItems.length === 0;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-clinical-fill" aria-hidden="true" />
          <h2 className="text-base font-semibold">Laboratory orders & results</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeItems.length > 0 ? (
            <Chip variant={allReady ? "success" : "warning"}>
              {allReady ? "All results ready" : `${readyCount}/${activeItems.length} ready`}
            </Chip>
          ) : (
            <span className="text-[13px] font-medium text-fg-muted">0 ordered</span>
          )}
          {!readOnly && !isEmpty ? (
            <OrderLabButton
              encounterId={encounterId}
              catalog={catalog}
              panels={panels}
              pendingCatalogItemIds={pendingCatalogItemIds}
              onOrdered={load}
            />
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-24 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Loading laboratory data…
        </div>
      ) : isEmpty ? (
        <EmptyLabsCard
          readOnly={readOnly}
          orderButton={
            !readOnly ? (
              <OrderLabButton
                encounterId={encounterId}
                catalog={catalog}
                panels={panels}
                pendingCatalogItemIds={pendingCatalogItemIds}
                onOrdered={load}
                trigger={
                  <Button type="button" className="min-h-11 gap-2 px-6">
                    <FlaskConical className="size-4" aria-hidden="true" />
                    Order lab / imaging
                  </Button>
                }
              />
            ) : null
          }
        />
      ) : (
        <LiveDoctorLabResults orders={orders} readOnly={readOnly} onChanged={load} />
      )}
    </section>
  );
}

function OrderLabButton({
  encounterId,
  catalog,
  panels,
  pendingCatalogItemIds,
  onOrdered,
  trigger,
}: {
  encounterId: string;
  catalog: CatalogItem[];
  panels: LabPanel[];
  pendingCatalogItemIds: Set<string>;
  onOrdered: () => Promise<void>;
  trigger?: ReactNode;
}) {
  return (
    <LiveOrderLabDialog
      encounterId={encounterId}
      catalog={catalog}
      panels={panels}
      pendingCatalogItemIds={pendingCatalogItemIds}
      onOrdered={onOrdered}
      trigger={trigger}
    />
  );
}

function EmptyLabsCard({
  readOnly,
  orderButton,
}: {
  readOnly: boolean;
  orderButton: ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-surface-1/60 px-6 py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-clinical-fill/10 text-clinical-fill">
          <FlaskConical className="size-7" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">No lab or imaging ordered yet</h3>
        <p className="mt-2 text-sm text-fg-secondary">
          {readOnly
            ? "This visit has no laboratory or imaging investigations on record."
            : "Order blood tests, panels, or imaging from the clinic catalog. Results will appear here when the lab completes them."}
        </p>
        {orderButton ? <div className="mt-6">{orderButton}</div> : null}
      </div>
    </div>
  );
}
