import { cn } from "@/lib/utils";

const PRIORITY_RANK: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };

/** Sort helper: emergency first, then urgent, then longest wait. */
export function byPriorityThenWait<T extends { priority: string; wait_minutes: number }>(a: T, b: T): number {
  const rank = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
  return rank !== 0 ? rank : b.wait_minutes - a.wait_minutes;
}

/** Shows only for urgent/emergency — routine patients need no badge. */
export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  if (priority !== "urgent" && priority !== "emergency") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        priority === "emergency" ? "bg-danger-fill/15 text-danger-text" : "bg-warning-fill/15 text-warning-text",
        className,
      )}
    >
      {priority}
    </span>
  );
}

export function priorityBorder(priority: string): string {
  if (priority === "emergency") return "border-l-4 border-l-danger-fill";
  if (priority === "urgent") return "border-l-4 border-l-warning-fill";
  return "";
}
