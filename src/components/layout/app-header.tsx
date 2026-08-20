"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import { initials } from "@/lib/format";
import { clinicName, navFor, roleHome, roleLabel } from "@/lib/nav";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

export function AppHeader() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const items = navFor(user.role);
  const current =
    [...items].reverse().find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? items[0];

  const roleRoleBadge: Record<Role, "clinical" | "info" | "warning" | "neutral"> = {
    doctor: "clinical",
    admin: "info",
    lab: "warning",
    receptionist: "neutral",
  };

  return (
    <header className="sticky top-0 z-30 flex h-[60px] w-full items-center justify-between gap-4 border-b border-border bg-surface-2/90 px-4 backdrop-blur-md transition-all sm:px-6">
      {/* Left Section: Sidebar Trigger & Single-Baseline Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1 text-fg-secondary hover:text-foreground hover:bg-surface-1 rounded-lg" />
        <div className="h-4 w-px bg-border shrink-0" />

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-medium text-fg-muted truncate">
            {clinicName}
          </span>
          <ChevronRight className="size-3.5 text-fg-muted/60 shrink-0" />
          <span className="text-[14px] font-semibold text-foreground tracking-tight truncate">
            {current?.label ?? "Workspace"}
          </span>
        </nav>
      </div>

      {/* Right Section: Operational Clock, Notifications & User Capsule */}
      <div className="flex items-center gap-2.5">
        {/* Live Operational Clock */}
        {time && (
          <div className="hidden md:flex items-center gap-2 rounded-full border border-border/80 bg-surface-1 px-3 py-1 text-[12px] font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono tabular-nums">{time} GMT</span>
            <span className="text-fg-muted font-normal">· Live</span>
          </div>
        )}

        {/* Notifications Button with Badge */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative size-9 rounded-lg text-fg-muted hover:text-foreground hover:bg-surface-1"
          onClick={() =>
            toast.info("No unread clinical alerts", {
              description: "All patient queues and lab requests are up to date.",
            })
          }
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-clinical-fill ring-2 ring-surface-2" />
        </Button>

        {/* User Account Capsule Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2.5 rounded-xl px-2 hover:bg-surface-1 border border-border/60 transition-all"
            >
              <Avatar size="sm" className="ring-1 ring-border/80">
                <AvatarFallback className="text-[12px] font-semibold bg-surface-1 text-foreground">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="hidden sm:flex flex-col text-left leading-none pr-1">
                <span className="text-[13px] font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="text-[11px] text-fg-muted mt-0.5">
                  {user.title} {user.room ? `· ${user.room}` : ""}
                </span>
              </div>

              <div className="hidden sm:block">
                <StatusBadge role={roleRoleBadge[user.role]} className="text-[10px] py-0 px-2">
                  {roleLabel[user.role]}
                </StatusBadge>
              </div>

              <ChevronDown className="size-3.5 text-fg-muted opacity-80 shrink-0" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60 p-1.5 rounded-xl shadow-xl">
            <DropdownMenuLabel className="px-2.5 py-2">
              <p className="text-[13px] font-semibold text-foreground">{user.name}</p>
              <p className="text-[11px] font-mono text-fg-muted font-normal">
                {user.id.toUpperCase()} · {roleLabel[user.role]}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className="rounded-lg text-[13px] py-2">
              <Link href={roleHome[user.role]} className="flex items-center gap-2">
                <UserCheck className="size-4 text-fg-muted" />
                <span>Go to my workspace</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-lg text-[13px] py-2">
              <Link href="/login" className="flex items-center gap-2">
                <Users className="size-4 text-fg-muted" />
                <span>Switch clinic role</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              className="rounded-lg text-[13px] py-2 text-danger-text focus:bg-danger-bg focus:text-danger-text cursor-pointer"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              <div className="flex items-center gap-2">
                <LogOut className="size-4" />
                <span>Sign out</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
