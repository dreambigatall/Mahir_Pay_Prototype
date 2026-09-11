import { apiRequest } from "@/lib/api/client";

export type BackendUser = {
  id?: string;
  userId?: string;
  email: string;
  full_name?: string;
  fullName?: string;
  title?: string | null;
  room?: string | null;
  must_change_password?: boolean;
  mustChangePassword?: boolean;
  roles: string[];
  permissions: string[];
};

export function login(email: string, password: string) {
  return apiRequest<{ user: BackendUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function currentSession() {
  return apiRequest<{ user: BackendUser }>("/auth/me");
}

export function logout() {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ user: BackendUser }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
