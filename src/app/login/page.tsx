"use client";

import { useRouter } from "next/navigation";
import {
  FlaskConical,
  LayoutDashboard,
  Stethoscope,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { clinicName, roleHome, roleLabel } from "@/lib/nav";
import { staff } from "@/lib/mock-data";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

const roleIcon: Record<Role, typeof Users> = {
  receptionist: Users,
  doctor: Stethoscope,
  lab: FlaskConical,
  admin: LayoutDashboard,
};

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 px-4 py-10">
      <div className="w-full max-w-3xl">
        <p className="text-[13px] font-medium text-fg-muted">{clinicName}</p>
        <h1 className="mt-1 text-[24px] leading-[1.3] font-semibold">
          Sign in to the clinic
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-fg-secondary">
          Prototype login — pick a role to open that workspace. No password in this UI build.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {staff.map((person) => {
            const Icon = roleIcon[person.role];
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  login(person);
                  router.push(roleHome[person.role]);
                }}
                className="rounded-xl border border-border bg-surface-2 p-4 text-left transition-colors hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium">{person.name}</p>
                    <p className="text-[13px] text-fg-secondary">{person.title}</p>
                  </div>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-surface-1 text-fg-secondary">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                </div>
                <p className="mt-4 text-[12px] font-medium text-fg-muted">
                  {roleLabel[person.role]}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-6">
          <Button variant="ghost" onClick={() => router.push("/design")}>
            View design system
          </Button>
        </div>
      </div>
    </div>
  );
}
