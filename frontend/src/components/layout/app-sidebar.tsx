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
import { useNavCounts } from "@/lib/use-nav-counts";
import { clinicName, designNav, navFor, roleHome, roleLabel } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const rolePortals: Record<string, string> = {
  doctor: "Doctor Workspace",
  receptionist: "Front Desk & Billing",
  lab: "Laboratory Diagnostics",
  pharmacist: "Pharmacy & Dispensing",
  admin: "Admin & Operations",
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const { isMobile, setOpenMobile, toggleSidebar, state } = useSidebar();
  const counts = useNavCounts(user?.role, user?.id);

  if (!user) return null;

  const items = navFor(user.role);

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const getBadgeForHref = (href: string) => {
    const count = counts[href];
    return count ? (count > 99 ? "99+" : String(count)) : null;
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
                      </Link>
                    </SidebarMenuButton>
                    {badge ? (
                      <SidebarMenuBadge
                        aria-label={`${badge} need attention`}
                        className="top-1/2 right-2 -translate-y-1/2 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground"
                      >
                        {badge}
                      </SidebarMenuBadge>
                    ) : null}
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
