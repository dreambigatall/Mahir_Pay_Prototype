import {
  BarChart3,
  Columns3,
  FlaskConical,
  LayoutDashboard,
  Palette,
  Receipt,
  Stethoscope,
  Syringe,
  Users,
} from "lucide-react";

import type { Role } from "@/lib/types";

export const clinicName = "Ridgeway Clinic";

export const roleHome: Record<Role, string> = {
  receptionist: "/receptionist",
  doctor: "/doctor",
  lab: "/lab",
  admin: "/admin",
};

export const roleLabel: Record<Role, string> = {
  receptionist: "Receptionist",
  doctor: "Doctor",
  lab: "Laboratory",
  admin: "Admin",
};

export function navFor(role: Role) {
  switch (role) {
    case "receptionist":
      return [
        { href: "/receptionist", label: "Queue", icon: Columns3 },
        { href: "/receptionist/courses", label: "Injections", icon: Syringe },
        { href: "/receptionist/patients", label: "Patients", icon: Users },
        { href: "/receptionist/billing", label: "Billing", icon: Receipt },
      ];
    case "doctor":
      return [
        { href: "/doctor", label: "Queue", icon: Columns3 },
        { href: "/doctor/patients", label: "My patients", icon: Stethoscope },
      ];
    case "lab":
      return [{ href: "/lab", label: "Lab board", icon: FlaskConical }];
    case "admin":
      return [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/users", label: "Staff", icon: Users },
        { href: "/admin/catalog", label: "Catalog", icon: Receipt },
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      ];
  }
}

export const designNav = {
  href: "/design",
  label: "Design system",
  icon: Palette,
};
