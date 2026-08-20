"use client";

import { useMemo, useState } from "react";
import {
  FlaskConical,
  PackageOpen,
  Pill,
  Plus,
  Receipt,
  Search,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";

import { AddCatalogItemDialog } from "@/components/clinic/add-catalog-item-dialog";
import { CatalogRowActions } from "@/components/clinic/catalog-row-actions";
import { EmptyState } from "@/components/clinic/empty-state";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";
import type { CatalogItem, CatalogType } from "@/lib/types";

type FilterTab = "all" | CatalogType | "inactive";

const typeBadges: Record<
  CatalogType,
  { label: string; role: "clinical" | "warning" | "info"; icon: typeof FlaskConical }
> = {
  lab_test: { label: "Lab test", role: "clinical", icon: FlaskConical },
  drug: { label: "Medication", role: "warning", icon: Pill },
  consultation: { label: "Consultation", role: "info", icon: Stethoscope },
  procedure: { label: "Injection / vaccine", role: "clinical", icon: Syringe },
};

export default function AdminCatalogPage() {
  const { catalog, ready } = useClinic();
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const total = catalog.length;
    const labCount = catalog.filter((item) => item.type === "lab_test" && item.active).length;
    const drugCount = catalog.filter((item) => item.type === "drug" && item.active).length;
    const consultCount = catalog.filter((item) => item.type === "consultation" && item.active).length;
    const procedureCount = catalog.filter((item) => item.type === "procedure" && item.active).length;
    const inactiveCount = catalog.filter((item) => !item.active).length;

    return { total, labCount, drugCount, consultCount, procedureCount, inactiveCount };
  }, [catalog]);

  const filteredItems = useMemo(() => {
    let list = catalog;

    // Filter by tab
    if (tab === "inactive") {
      list = list.filter((item) => !item.active);
    } else if (tab !== "all") {
      list = list.filter((item) => item.type === tab);
    }

    // Filter by search query
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          typeBadges[item.type].label.toLowerCase().includes(q),
      );
    }

    return list;
  }, [catalog, tab, search]);

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service catalog"
        description="Standard clinic pricing for consultations, lab orders, pharmacy, and injection/vaccination courses."
        action={<AddCatalogItemDialog />}
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Lab tests</span>
            <FlaskConical className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">
            {stats.labCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Active orderable tests</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Medications</span>
            <Pill className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">
            {stats.drugCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Pharmacy line items</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Consultations</span>
            <Stethoscope className="size-4 text-info-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">
            {stats.consultCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Base visit services</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Injections</span>
            <Syringe className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">
            {stats.procedureCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Vaccines & daily procedures</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total items</span>
            <Receipt className="size-4 text-fg-muted" />
          </div>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">
            {stats.total}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {stats.inactiveCount > 0
              ? `${stats.inactiveCount} inactive`
              : "All active"}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Tabs */}
        <Tabs
          value={tab}
          onValueChange={(val) => setTab(val as FilterTab)}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9 bg-surface-1 p-1">
            <TabsTrigger value="all" className="text-[13px]">
              All ({catalog.length})
            </TabsTrigger>
            <TabsTrigger value="lab_test" className="text-[13px]">
              Lab tests ({catalog.filter((i) => i.type === "lab_test").length})
            </TabsTrigger>
            <TabsTrigger value="drug" className="text-[13px]">
              Medications ({catalog.filter((i) => i.type === "drug").length})
            </TabsTrigger>
            <TabsTrigger value="consultation" className="text-[13px]">
              Consultations ({catalog.filter((i) => i.type === "consultation").length})
            </TabsTrigger>
            <TabsTrigger value="procedure" className="text-[13px]">
              Injections ({catalog.filter((i) => i.type === "procedure").length})
            </TabsTrigger>
            {stats.inactiveCount > 0 && (
              <TabsTrigger value="inactive" className="text-[13px]">
                Inactive ({stats.inactiveCount})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {/* Real-time Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items or codes…"
            className="h-9 pl-8 pr-8 text-[13px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Catalog Table View */}
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
                <TableHead className="h-11 w-[32%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Item & Code
                </TableHead>
                <TableHead className="h-11 w-[22%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Category
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Price (GHS)
                </TableHead>
                <TableHead className="h-11 w-[18%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Status
                </TableHead>
                <TableHead className="h-11 w-[8%] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const badge = typeBadges[item.type];
                return (
                  <TableRow key={item.id} className="h-12 hover:bg-surface-1/60">
                    {/* Item Name and Monospace ID */}
                    <TableCell className="px-4 py-2.5 text-left">
                      <p className="truncate text-[14px] font-medium text-foreground">
                        {item.name}
                      </p>
                      <p className="font-mono text-[11px] text-fg-muted uppercase">
                        {item.id}
                      </p>
                    </TableCell>

                    {/* Category Pill */}
                    <TableCell className="px-4 py-2.5 text-left">
                      <StatusBadge role={badge.role} className="gap-1 font-normal">
                        <badge.icon className="size-3" />
                        {badge.label}
                      </StatusBadge>
                    </TableCell>

                    {/* Price */}
                    <TableCell className="px-4 py-2.5 text-left font-mono text-[13px] font-medium tabular-nums text-foreground">
                      {formatMoney(item.price)}
                    </TableCell>

                    {/* Active/Inactive Status */}
                    <TableCell className="px-4 py-2.5 text-left">
                      {item.active ? (
                        <StatusBadge role="success">Active</StatusBadge>
                      ) : (
                        <StatusBadge role="neutral">Inactive</StatusBadge>
                      )}
                    </TableCell>

                    {/* Row Action Dropdown Menu */}
                    <TableCell className="px-4 py-2.5 text-right">
                      <CatalogRowActions item={item} />
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
