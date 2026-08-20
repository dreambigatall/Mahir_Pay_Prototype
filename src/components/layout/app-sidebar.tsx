"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronRight,
  LogOut,
  Palette,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useClinic } from "@/lib/clinic-store";
import { CLINIC_TODAY, initials } from "@/lib/format";
import { clinicName, designNav, navFor, roleHome, roleLabel } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const rolePortals: Record<string, string> = {
  doctor: "Doctor Workspace",
  receptionist: "Front Desk & Billing",
  lab: "Laboratory Diagnostics",
  admin: "Admin & Operations",
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  const { visits, labRequests, catalog, courses, doses } = useClinic();

  if (!user) return null;

  const items = navFor(user.role);

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Dynamic live count badges for nav items
  const getBadgeForHref = (href: string) => {
    if (href === "/doctor") {
      const myVisits = visits.filter(
        (v) =>
          v.doctorId === user.id &&
          v.status !== "billed" &&
          v.status !== "cancelled",
      );
      return myVisits.length > 0 ? String(myVisits.length) : null;
    }
    if (href === "/receptionist") {
      const waiting = visits.filter((v) => v.status === "registered");
      return waiting.length > 0 ? String(waiting.length) : null;
    }
    if (href === "/receptionist/billing") {
      const unpaid = visits.filter(
        (v) => v.status === "ready-for-billing" || v.status === "lab-complete",
      );
      return unpaid.length > 0 ? String(unpaid.length) : null;
    }
    if (href === "/lab") {
      const pendingLabs = labRequests.filter(
        (req) => req.status !== "result-ready",
      );
      return pendingLabs.length > 0 ? String(pendingLabs.length) : null;
    }
    if (href === "/receptionist/courses") {
      const due = doses.filter(
        (dose) =>
          dose.scheduledDate === CLINIC_TODAY &&
          dose.status !== "given" &&
          dose.status !== "missed" &&
          courses.some((course) => course.id === dose.courseId && course.status === "active"),
      );
      return due.length > 0 ? String(due.length) : null;
    }
    return null;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-1 py-1">
              {/* Brand Logo Emblem */}
              <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Stethoscope className="size-4 text-white" strokeWidth={2} />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
              </div>

              {/* Clinic & Portal Title */}
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[14px] font-bold text-foreground tracking-tight">
                  {clinicName}
                </span>
                <span className="truncate text-[11px] font-medium text-fg-muted">
                  {rolePortals[user.role] ?? roleLabel[user.role]}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Navigation Content */}
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold tracking-wider text-fg-muted uppercase group-data-[collapsible=icon]:hidden mb-1">
            Clinical Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active =
                  item.href === roleHome[user.role]
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const badge = getBadgeForHref(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        "relative text-[13.5px] transition-all",
                        active && "font-semibold text-foreground bg-surface-2 shadow-xs border border-border/80",
                      )}
                    >
                      <Link href={item.href} onClick={closeMobile}>
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-clinical-fill group-data-[collapsible=icon]:hidden" />
                        )}
                        <Icon
                          className={cn(
                            "size-[18px]",
                            active ? "text-clinical-fill" : "text-fg-muted",
                          )}
                          strokeWidth={active ? 2 : 1.75}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                          <span
                            className={cn(
                              "ml-auto rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums group-data-[collapsible=icon]:hidden",
                              active
                                ? "bg-clinical-fill text-white"
                                : "bg-surface-1 text-fg-secondary border border-border/80",
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Tools & User Account */}
      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-2">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={designNav.label}
              className="text-[13px] text-fg-secondary hover:text-foreground"
            >
              <Link href={designNav.href} onClick={closeMobile}>
                <Palette className="size-[17px] text-fg-muted" strokeWidth={1.75} />
                <span>{designNav.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="text-[13px] text-fg-secondary hover:text-danger-text hover:bg-danger-bg/40 transition-colors"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              <LogOut className="size-[17px] text-fg-muted group-hover:text-danger-text" strokeWidth={1.75} />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User Account Capsule Card */}
        <div className="rounded-xl border border-border/80 bg-surface-2 p-2.5 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2.5">
            <Avatar size="sm" className="ring-1 ring-border shrink-0">
              <AvatarFallback className="text-[11px] font-semibold bg-surface-1 text-foreground">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-fg-muted">
                {user.title} {user.room ? `· ${user.room}` : ""}
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
