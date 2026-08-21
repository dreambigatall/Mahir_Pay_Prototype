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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl bg-surface-1 p-8 sm:p-12 shadow-sm border border-border/50">
        <p className="text-sm font-semibold text-primary uppercase tracking-wider">{clinicName}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl leading-tight font-bold font-heading">
          Sign in to the clinic
        </h1>
        <p className="mt-3 max-w-xl text-sm sm:text-base text-muted-foreground">
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
                className="group rounded-2xl border border-transparent bg-card p-5 text-left shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{person.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{person.title}</p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                </div>
                <p className="mt-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
