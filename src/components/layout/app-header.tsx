"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { clinicName, navFor, roleHome, roleLabel } from "@/lib/nav";
import { useSession } from "@/lib/session";

export function AppHeader() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  if (!user) return null;

  const items = navFor(user.role);
  const current =
    [...items].reverse().find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    items[0];

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <div className="min-w-0">
          <p className="truncate text-[13px] text-fg-muted">{clinicName}</p>
          <p className="truncate text-sm font-medium">{current?.label}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar size="sm">
                <AvatarFallback className="text-[11px]">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-medium">{user.name}</span>
                <span className="block text-[12px] font-normal text-fg-muted">
                  {roleLabel[user.role]}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              Signed in as {user.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={roleHome[user.role]}>Go to my workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/login">Switch role</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
