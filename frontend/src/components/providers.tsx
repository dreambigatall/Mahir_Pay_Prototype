"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { ClinicProvider } from "@/lib/clinic-store";
import { SessionProvider } from "@/lib/session";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <SessionProvider>
        <ClinicProvider>
          {children}
          <Toaster position="top-right" />
        </ClinicProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
