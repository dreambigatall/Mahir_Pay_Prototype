"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { StaffUser, Role } from "@/lib/types";

export type SessionUser = StaffUser & { email: string; mustChangePassword: boolean };

type SessionContextValue = {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
};

const supportedRoles = new Set<Role>(["receptionist", "doctor", "lab", "pharmacist", "admin"]);
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    authApi.currentSession()
      .then(({ user: backendUser }) => {
        if (active) setUser(toSessionUser(backendUser));
      })
      .catch((error: unknown) => {
        if (active && (!(error instanceof ApiError) || ![401, 403].includes(error.status))) console.error("Session hydration failed", error);
      })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password); const next = toSessionUser(response.user); setUser(next); return next;
  }, []);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await authApi.changePassword(currentPassword, newPassword);
    setUser(toSessionUser(response.user));
  }, []);
  const logout = useCallback(async () => { try { await authApi.logout(); } finally { setUser(null); } }, []);
  const value = useMemo<SessionContextValue>(() => ({ user, ready, login, changePassword, logout }), [user, ready, login, changePassword, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() { const context = useContext(SessionContext); if (!context) throw new Error("useSession must be used within SessionProvider"); return context; }

function toSessionUser(user: authApi.BackendUser): SessionUser {
  const role = user.roles.find((value): value is Role => supportedRoles.has(value as Role));
  if (!role) throw new ApiError(403, "WORKSPACE_UNAVAILABLE", "This staff role does not have a frontend workspace yet");
  const id = user.id ?? user.userId;
  if (!id) throw new ApiError(500, "SESSION_USER_INVALID", "The server returned an invalid user session");
  return { id, email: user.email, name: user.full_name ?? user.fullName ?? user.email, role, title: user.title ?? role, room: user.room ?? undefined, mustChangePassword: user.must_change_password ?? user.mustChangePassword ?? false };
}
