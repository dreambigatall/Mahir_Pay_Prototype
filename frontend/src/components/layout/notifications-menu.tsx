"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from "@/lib/api/notifications";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

function linkFor(notification: NotificationDto, role: Role): string | null {
  if (notification.resource_type === "treatment_course" && notification.resource_id && role === "receptionist") {
    return `/receptionist/courses/${notification.resource_id}`;
  }
  return null;
}

function timeAgo(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));
}

export function NotificationsMenu({ role }: { role: Role }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await listNotifications()).items);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const unread = items.filter((item) => !item.read_at).length;

  async function openItem(item: NotificationDto) {
    if (!item.read_at) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)));
      void markNotificationRead(item.id).catch(() => void load());
    }
    const href = linkFor(item, role);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  async function markAll() {
    const now = new Date().toISOString();
    setItems((current) => current.map((entry) => ({ ...entry, read_at: entry.read_at ?? now })));
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) void load(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative size-10 rounded-xl text-muted-foreground transition-all hover:bg-surface-1 hover:text-foreground"
        >
          <Bell className="size-5" strokeWidth={2} />
          {unread ? (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fill px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => void markAll()}>
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <p className="flex items-center justify-center gap-2 p-6 text-sm text-fg-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </p>
          ) : error ? (
            <p className="p-6 text-center text-sm text-fg-muted">Notifications could not be loaded.</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-fg-muted">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      "flex w-full gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-1",
                      !item.read_at && "bg-primary/5",
                    )}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-fg-secondary">{item.message}</span>
                      <span className="mt-1 block text-[11px] text-fg-muted">{timeAgo(item.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
