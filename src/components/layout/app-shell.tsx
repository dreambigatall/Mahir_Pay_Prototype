"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { roleHome } from "@/lib/nav";
import { useSession } from "@/lib/session";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const home = roleHome[user.role];
    const allowed = pathname === home || pathname.startsWith(`${home}/`);
    if (!allowed) router.replace(home);
  }, [ready, user, pathname, router]);

  if (!ready || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <SidebarProvider className="bg-background">
      <AppSidebar />
      <SidebarInset className="bg-transparent overflow-hidden flex flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-background rounded-tl-[32px] border-t border-l border-border/60 shadow-sm p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
