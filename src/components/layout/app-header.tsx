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
import { Chip } from "@/components/ui/chip";
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
    <header className="sticky top-0 z-30 flex h-[72px] w-full items-center justify-between gap-6 bg-[#f4eafe] px-6 transition-all sm:px-10">
      {/* Left Section: Single-Baseline Breadcrumb */}
      <div className="flex min-w-0 items-center gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13px] font-medium text-foreground/80 truncate">
            {clinicName}
          </span>
          <ChevronRight className="size-3.5 text-foreground/60 shrink-0" />
          <span className="text-[14px] font-bold text-foreground tracking-tight truncate">
            {current?.label ?? "Workspace"}
          </span>
        </nav>
      </div>

      {/* Right Section: Operational Clock, Notifications & User Capsule */}
      <div className="flex items-center gap-2.5">


        {/* Notifications Button with Badge */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative size-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all"
          onClick={() =>
            toast.info("No unread clinical alerts", {
              description: "All patient queues and lab requests are up to date.",
            })
          }
        >
          <Bell className="size-5" strokeWidth={2} />
          <span className="absolute top-2 right-2.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        {/* User Account Capsule Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-11 gap-3 rounded-2xl px-2.5 hover:bg-surface-1 border border-transparent hover:border-border/50 hover:shadow-sm transition-all duration-300"
            >
              <Avatar size="sm" className="ring-2 ring-background shadow-sm">
                <AvatarFallback className="text-[12px] font-bold bg-primary/10 text-primary">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="hidden sm:flex flex-col text-left leading-none pr-1">
                <span className="text-sm font-bold font-heading text-foreground">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {user.title} {user.room ? `· ${user.room}` : ""}
                </span>
              </div>

              <ChevronDown className="size-4 text-muted-foreground opacity-70 shrink-0" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl border border-border/40 shadow-2xl bg-background/95 backdrop-blur-xl">
            <DropdownMenuLabel className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-primary/10 shadow-sm shrink-0">
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-bold font-heading text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {user.id.toUpperCase()} · {roleLabel[user.role]}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator className="mx-2 my-1 bg-border/40" />

            <DropdownMenuItem
              variant="destructive"
              className="rounded-xl text-sm py-2.5 px-3 mx-1 mb-1 text-red-600 focus:bg-red-50/50 hover:bg-red-50/50 focus:text-red-700 hover:text-red-700 cursor-pointer transition-all"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <LogOut className="size-4" />
                <span className="font-medium">Sign Out</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
