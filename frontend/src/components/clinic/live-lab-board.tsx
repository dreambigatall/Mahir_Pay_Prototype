"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  FlaskConical,
  GripVertical,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

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
import { ApiError } from "@/lib/api/client";
import { listDiagnosticWorklist, type WorklistDiagnosticOrder } from "@/lib/api/diagnostics";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";

type FilterTab = "all" | "urgent" | "pending" | "verified" | "completed";
type LabColumnId = "requested" | "in_progress" | "result_ready" | "verified" | "reviewed";

const LAB_COLUMNS: { id: LabColumnId; title: string }[] = [
  { id: "requested", title: "Requested" },
  { id: "in_progress", title: "In analysis" },
  { id: "result_ready", title: "Pending verification" },
  { id: "verified", title: "Verified" },
  { id: "reviewed", title: "Completed today" },
];

function orderColumn(status: string): LabColumnId {
  if (status === "requested") return "requested";
  if (status === "in_progress") return "in_progress";
  if (status === "result_ready") return "result_ready";
  if (status === "verified") return "verified";
  if (status === "reviewed") return "reviewed";
  return "in_progress";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function LiveLabBoard() {
  const [orders, setOrders] = useState<WorklistDiagnosticOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const load = useCallback(async (quiet = false, signal?: AbortSignal) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await listDiagnosticWorklist(signal);
      if (signal?.aborted) return;
      setOrders(response.items);
    } catch (caught) {
      if (signal?.aborted) return;
      setError(caught instanceof ApiError ? caught.message : "The laboratory worklist could not be loaded.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    };
  }, [load]);

  const stats = useMemo(() => {
    const total = orders.length;
    const testCount = orders.reduce((sum, order) => sum + order.items.length, 0);
    const urgentCount = orders.filter(
      (order) => order.urgency === "urgent" && !["verified", "reviewed"].includes(order.status),
    ).length;
    const requestedCount = orders.filter((order) => order.status === "requested").length;
    const inProgressCount = orders.filter((order) => order.status === "in_progress").length;
    const pendingVerifyCount = orders.filter((order) => order.status === "result_ready").length;
    const withDoctorCount = orders.filter((order) => order.status === "verified").length;
    const completedCount = orders.filter((order) => order.status === "reviewed").length;
    const activeCount = requestedCount + inProgressCount + pendingVerifyCount;
    const labCompleteCount = withDoctorCount + completedCount;
    const pendingCount = total - withDoctorCount - completedCount;

    return {
      total,
      testCount,
      urgentCount,
      requestedCount,
      inProgressCount,
      pendingVerifyCount,
      withDoctorCount,
      completedCount,
      activeCount,
      labCompleteCount,
      pendingCount,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;

    if (filterTab === "urgent") {
      list = list.filter((order) => order.urgency === "urgent");
    } else if (filterTab === "pending") {
      list = list.filter((order) => !["verified", "reviewed"].includes(order.status));
    } else if (filterTab === "verified") {
      list = list.filter((order) => order.status === "verified");
    } else if (filterTab === "completed") {
      list = list.filter((order) => order.status === "reviewed");
    }

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((order) =>
        [order.patient_name, order.visit_number, order.items.map((item) => item.item_name).join(" ")]
          .some((field) => field.toLowerCase().includes(query)),
      );
    }

    return list;
  }, [filterTab, orders, search]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [filteredOrders]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -402 : 402, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading laboratory worklist">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-96 w-[400px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total requisitions</span>
            <FlaskConical className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">{stats.total}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {stats.testCount} individual {stats.testCount === 1 ? "test" : "tests"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Urgent / STAT</span>
            <AlertCircle className="size-4 text-danger-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-danger-text">{stats.urgentCount}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Open priority requisitions</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">In analysis</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-warning-text">
            {stats.requestedCount + stats.inProgressCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {stats.requestedCount} queued · {stats.inProgressCount} active · {stats.pendingVerifyCount} awaiting verify
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Completed today</span>
            <CheckCircle2 className="size-4 text-success-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-success-text">{stats.completedCount}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {stats.withDoctorCount} with doctor · {stats.labCompleteCount} lab-complete total
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={filterTab} onValueChange={(value) => setFilterTab(value as FilterTab)}>
          <SelectTrigger className="h-9 w-full border-border/60 bg-background px-4 text-[13px] font-medium transition-colors hover:bg-surface-2 focus:ring-1 focus:ring-ring/50 sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-primary" />
              <SelectValue placeholder="Filter views..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <span>All requisitions</span>
                <span className="ml-3 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">
                  {stats.total}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="urgent" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-3.5 text-danger-fill" />
                  <span>Urgent</span>
                </div>
                <span className="ml-3 rounded-full bg-danger-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-danger-text">
                  {stats.urgentCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="pending" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-warning-fill" />
                  <span>Pending</span>
                </div>
                <span className="ml-3 rounded-full bg-warning-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-warning-text">
                  {stats.pendingCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="verified" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success-fill" />
                  <span>With doctor</span>
                </div>
                <span className="ml-3 rounded-full bg-success-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-success-text">
                  {stats.withDoctorCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="completed" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-clinical-fill" />
                  <span>Completed today</span>
                </div>
                <span className="ml-3 rounded-full bg-clinical-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-clinical-text">
                  {stats.completedCount}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient or test…"
              aria-label="Search laboratory worklist"
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

      <div className="group relative mt-2">
        {showLeft ? (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-3 shadow-lg backdrop-blur-sm transition-all hover:bg-surface-2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-6 text-primary" />
          </button>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-0.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {LAB_COLUMNS.map((column) => {
            const columnCards = filteredOrders.filter((order) => orderColumn(order.status) === column.id);
            return (
              <div key={column.id} className="w-[400px] shrink-0 rounded-2xl bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3.5">
                  <p className="font-heading text-xl font-bold tracking-tight text-foreground">{column.title}</p>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground">
                    {columnCards.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {columnCards.length === 0 ? (
                    <p className="py-12 text-center text-[16px] text-fg-muted">No requisitions in this stage</p>
                  ) : (
                    columnCards.map((order) => <LabOrderCard key={order.id} order={order} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showRight ? (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-3 shadow-lg backdrop-blur-sm transition-all hover:bg-surface-2"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-6 text-primary" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LabOrderCard({ order }: { order: WorklistDiagnosticOrder }) {
  const testNames = order.items.map((item) => item.item_name).join(", ");
  const enteredStatuses = new Set(["result_ready", "verified", "reviewed"]);
  const verifiedStatuses = new Set(["verified", "reviewed"]);
  const savedCount = order.items.filter((item) => enteredStatuses.has(item.status)).length;
  const verifiedCount = order.items.filter((item) => verifiedStatuses.has(item.status)).length;
  const isVerified = order.status === "verified";
  const isCompleted = order.status === "reviewed";

  return (
    <Link
      href={`/lab/requests/${order.id}`}
      className="group mb-3 block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <GripVertical className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          <p className="truncate font-heading text-lg font-bold text-foreground transition-colors group-hover:text-primary">
            {order.patient_name}
          </p>
        </div>
        {order.urgency === "urgent" ? (
          <Chip variant="warning">Urgent</Chip>
        ) : (
          <Chip variant="neutral">Routine</Chip>
        )}
      </div>

      <p className="mt-2.5 font-mono text-sm text-muted-foreground">
        {order.visit_number} · {formatDateTime(order.ordered_at)}
      </p>

      <div className="mt-3 rounded-md border border-border/60 bg-surface-1 p-2">
        <p className="text-[13px] font-medium tabular-nums text-foreground">
          {order.items.length} {order.items.length === 1 ? "test" : "tests"}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-fg-secondary">{testNames}</p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4 text-[13px]">
        <span className="text-fg-muted">
          {isCompleted
            ? `${order.items.length}/${order.items.length} tests complete`
            : `${savedCount}/${order.items.length} results entered`}
        </span>
        {isCompleted ? (
          <span className="flex items-center gap-1 font-medium text-clinical-text">
            <CheckCircle2 className="size-3.5" />
            Sent to doctor
          </span>
        ) : isVerified ? (
          <span className="flex items-center gap-1 font-medium text-success-text">
            <CheckCircle2 className="size-3.5" />
            Verified
          </span>
        ) : order.status === "result_ready" ? (
          <span className="font-medium text-warning-text">Awaiting verification</span>
        ) : order.status === "in_progress" ? (
          <span className="font-medium text-clinical-text">{verifiedCount} verified</span>
        ) : (
          <span className="font-medium text-fg-secondary">Not started</span>
        )}
      </div>
    </Link>
  );
}
