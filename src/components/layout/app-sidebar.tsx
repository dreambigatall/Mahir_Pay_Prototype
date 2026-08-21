"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronLeft,
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
  const { isMobile, setOpenMobile, toggleSidebar, state } = useSidebar();
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
    <Sidebar collapsible="icon" className="border-none bg-surface-1">
      {/* Brand Header */}
      <SidebarHeader className="p-3 relative">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          className="absolute right-2 top-14 group-data-[collapsible=icon]:right-1/2 group-data-[collapsible=icon]:translate-x-1/2 group-data-[collapsible=icon]:top-auto group-data-[collapsible=icon]:-bottom-2 z-50 hidden md:flex size-6 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm hover:bg-surface-1 transition-all text-muted-foreground hover:text-foreground hover:scale-110"
        >
          <ChevronLeft className={cn("size-3.5 transition-transform duration-200", state === "collapsed" && "rotate-180")} />
        </button>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex flex-col items-center gap-4 px-2 pt-8 pb-5">
              {/* Brand Logo Emblem */}
              <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:rounded-xl transition-all duration-300">
                <Stethoscope className="size-8 text-white group-data-[collapsible=icon]:size-4.5 transition-all duration-300" strokeWidth={2} />
              </div>

              {/* Clinic & Portal Title */}
              <div className="flex flex-col items-center justify-center text-center min-w-0 w-full leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate w-full text-[18px] font-bold text-foreground tracking-tight">
                  {clinicName}
                </span>
                <span className="truncate w-full text-[13px] font-medium text-fg-muted mt-1">
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
                        <Icon
                          className={cn(
                            "size-[18px]",
                            active ? "text-clinical-fill" : "text-fg-muted",
                          )}
                          strokeWidth={active ? 2 : 1.75}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 size-2 rounded-full bg-clinical-fill group-data-[collapsible=icon]:hidden" />
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


      <SidebarRail />
    </Sidebar>
  );
}
