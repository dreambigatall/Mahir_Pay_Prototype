"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  FlaskConical,
  Layers,
  Loader2,
  Package,
  PackageOpen,
  Pill,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";

import { AddCatalogItemDialog } from "@/components/clinic/add-catalog-item-dialog";
import { AddLabPanelDialog } from "@/components/clinic/add-lab-panel-dialog";
import { CatalogRowActions } from "@/components/clinic/catalog-row-actions";
import { EmptyState } from "@/components/clinic/empty-state";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { listCatalogItems, listLabPanels, type CatalogItem, type CatalogItemType, type LabPanel } from "@/lib/api/catalog";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";

type FilterTab = "all" | CatalogItemType | "inactive";

const typeBadges: Record<
  CatalogItemType,
  { label: string; role: "clinical" | "warning" | "info"; icon: typeof FlaskConical }
> = {
  lab_test: { label: "Lab test", role: "clinical", icon: FlaskConical },
  drug: { label: "Medication", role: "warning", icon: Pill },
  consultation: { label: "Consultation", role: "info", icon: Stethoscope },
  procedure: { label: "Injection / vaccine", role: "clinical", icon: Syringe },
  radiology: { label: "Radiology", role: "clinical", icon: FlaskConical },
  lab_panel: { label: "Lab panel", role: "clinical", icon: Layers },
  supply: { label: "Clinic supply", role: "info", icon: Package },
};

function StockCell({ item }: { item: CatalogItem }) {
  const onHand = Number(item.quantity_on_hand ?? 0);
  const reorder = Number(item.reorder_level ?? 0);
  const low = reorder > 0 && onHand <= reorder;

  return (
    <div>
      <p className={`font-mono font-medium tabular-nums ${low ? "text-warning-text" : "text-foreground"}`}>
        {onHand}
        {item.unit ? ` ${item.unit}` : ""}
      </p>
      {reorder > 0 ? (
        <p className="mt-0.5 text-[10px] text-fg-muted">Reorder at {reorder}</p>
      ) : null}
    </div>
  );
}

export default function AdminCatalogPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [response, panelResponse] = await Promise.all([
        listCatalogItems({ includeInactive: true }),
        listLabPanels({ includeInactive: true }),
      ]);
      setCatalog(response.items);
      setPanels(panelResponse.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The service catalog could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load(true);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh);
  }, [load]);

  const billedCatalog = useMemo(
    () => catalog.filter((item) => item.item_type !== "supply"),
    [catalog],
  );

  const stats = useMemo(() => {
    const total = billedCatalog.length;
    const labCount = billedCatalog.filter((item) => item.item_type === "lab_test" && item.active).length;
    const drugCount = billedCatalog.filter((item) => item.item_type === "drug" && item.active).length;
    const consultCount = billedCatalog.filter((item) => item.item_type === "consultation" && item.active).length;
    const procedureCount = billedCatalog.filter((item) => item.item_type === "procedure" && item.active).length;
    const panelCount = billedCatalog.filter((item) => item.item_type === "lab_panel" && item.active).length;
    const inactiveCount = billedCatalog.filter((item) => !item.active).length;
    return { total, labCount, drugCount, consultCount, procedureCount, panelCount, inactiveCount };
  }, [billedCatalog]);

  const filteredItems = useMemo(() => {
    let list = billedCatalog;

    if (tab === "inactive") {
      list = list.filter((item) => !item.active);
    } else if (tab !== "all") {
      list = list.filter((item) => item.item_type === tab);
    }

    const value = search.trim().toLowerCase();
    if (value) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(value) ||
          item.item_code.toLowerCase().includes(value) ||
          typeBadges[item.item_type].label.toLowerCase().includes(value),
      );
    }

    return list;
  }, [billedCatalog, tab, search]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Service catalog"
          description="Standard clinic pricing for consultations, lab orders, pharmacy, and injection/vaccination courses."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service catalog"
        description="Standard clinic pricing for consultations, lab orders, pharmacy, and injection/vaccination courses."
        action={
          <div className="flex flex-wrap gap-2">
            <AddLabPanelDialog onSaved={() => void load(true)} />
            <AddCatalogItemDialog onSaved={() => void load(true)} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Lab tests</span>
            <FlaskConical className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{stats.labCount}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Active orderable tests</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Medications</span>
            <Pill className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{stats.drugCount}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Pharmacy line items</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Consultations</span>
            <Stethoscope className="size-4 text-info-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{stats.consultCount}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Base visit services</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Injections</span>
            <Syringe className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{stats.procedureCount}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Vaccines & daily procedures</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total items</span>
            <Receipt className="size-4 text-fg-muted" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{stats.total}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {stats.inactiveCount > 0 ? `${stats.inactiveCount} inactive` : "All active"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={tab} onValueChange={(value) => setTab(value as FilterTab)}>
          <SelectTrigger className="h-9 w-full bg-background sm:w-[200px]">
            <SelectValue placeholder="Filter category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({billedCatalog.length})</SelectItem>
            <SelectItem value="lab_test">Lab tests ({catalog.filter((i) => i.item_type === "lab_test").length})</SelectItem>
            <SelectItem value="drug">Medications ({catalog.filter((i) => i.item_type === "drug").length})</SelectItem>
            <SelectItem value="consultation">Consultations ({catalog.filter((i) => i.item_type === "consultation").length})</SelectItem>
            <SelectItem value="radiology">Radiology ({catalog.filter((i) => i.item_type === "radiology").length})</SelectItem>
            <SelectItem value="lab_panel">Lab panels ({catalog.filter((i) => i.item_type === "lab_panel").length})</SelectItem>
            <SelectItem value="procedure">Injections ({catalog.filter((i) => i.item_type === "procedure").length})</SelectItem>
            {stats.inactiveCount > 0 ? (
              <SelectItem value="inactive">Inactive ({stats.inactiveCount})</SelectItem>
            ) : null}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search items or codes…"
              className="h-9 pr-8 pl-8 text-[13px]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Button type="button" variant="outline" className="h-9 gap-2" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4" aria-hidden="true" />
            {error}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={search ? "No matching items found" : "No items in this category"}
          description={
            search
              ? `No catalog items matched "${search}". Try adjusting your search query.`
              : "There are currently no items configured under this category."
          }
          action={
            search ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : (
              <AddCatalogItemDialog
                defaultType={tab !== "all" && tab !== "inactive" ? tab : "lab_test"}
                onSaved={() => void load(true)}
                trigger={
                  <Button size="sm" className="gap-1">
                    <Plus className="size-3.5" />
                    Add item
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[28%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Item & Code
                </TableHead>
                <TableHead className="h-11 w-[18%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Category
                </TableHead>
                <TableHead className="h-11 w-[14%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Price (GHS)
                </TableHead>
                <TableHead className="h-11 w-[14%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Stock
                </TableHead>
                <TableHead className="h-11 w-[14%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Status
                </TableHead>
                <TableHead className="h-11 w-[12%] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const badge = typeBadges[item.item_type];
                const panel = item.item_type === "lab_panel" ? panels.find((entry) => entry.id === item.id) : undefined;
                return (
                  <TableRow key={item.id} className="h-12 hover:bg-surface-1/60">
                    <TableCell className="px-4 py-2.5 text-left">
                      <p className="truncate text-[14px] font-medium text-foreground">{item.name}</p>
                      <p className="font-mono text-[11px] text-fg-muted uppercase">{item.item_code}</p>
                      {panel?.members.length ? (
                        <p className="mt-0.5 truncate text-[11px] text-fg-muted">
                          {panel.members.map((member) => member.name).join(" · ")}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      <Chip variant={badge.role} className="gap-1 font-normal">
                        <badge.icon className="size-3" />
                        {badge.label}
                      </Chip>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left font-mono text-[13px] font-medium text-foreground tabular-nums">
                      {formatMoney(Number(item.price))}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left text-[12px]">
                      {item.item_type === "lab_panel" ? (
                        <span className="text-fg-secondary">{panel?.members.length ?? 0} tests</span>
                      ) : item.track_inventory ? (
                        <StockCell item={item} />
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      {item.active ? (
                        <Chip variant="success">Active</Chip>
                      ) : (
                        <Chip variant="neutral">Inactive</Chip>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-right">
                      <CatalogRowActions item={item} panel={panel} onChanged={() => void load(true)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
