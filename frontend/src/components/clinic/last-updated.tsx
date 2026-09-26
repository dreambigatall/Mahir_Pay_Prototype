"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ago(from: Date | null, now: number): string {
  if (!from) return "Not loaded yet";
  const seconds = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)} min ago`;
}

/** Shows how fresh the board is, with a one-click refresh. */
export function LastUpdated({ at, refreshing, onRefresh }: { at: Date | null; refreshing: boolean; onRefresh: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs text-fg-muted">
      <span aria-live="polite">{refreshing ? "Refreshing…" : ago(at, now)}</span>
      <Button type="button" variant="ghost" size="icon" className="size-8" disabled={refreshing} onClick={onRefresh} aria-label="Refresh now">
        <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
      </Button>
    </div>
  );
}
