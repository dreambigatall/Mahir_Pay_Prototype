import { apiRequest } from "@/lib/api/client";

export type StaffStatus = "active" | "disabled" | "locked";

export type BackendStaffMember = {
  id: string;
  email: string;
  full_name: string;
  title: string | null;
  room: string | null;
  status: StaffStatus;
  must_change_password: boolean;
  roles: string[];
  created_at: string;
  updated_at: string;
};

export type BackendRole = {
  slug: string;
  name: string;
  description: string | null;
};

export function listStaff(page = 1, pageSize = 25) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiRequest<{ items: BackendStaffMember[]; total: number; page: number; pageSize: number }>(`/staff?${query}`);
}

export function listRoles() {
  return apiRequest<{ items: BackendRole[] }>("/staff/roles");
}

export type BackendDoctor = {
  id: string;
  full_name: string;
  title: string | null;
  room: string | null;
};

export function listDoctors() {
  return apiRequest<{ items: BackendDoctor[] }>("/staff/doctors");
}

export function createStaff(input: {
  email: string;
  temporaryPassword: string;
  fullName: string;
  title?: string;
  room?: string;
  roles: string[];
}) {
  return apiRequest<{ item: BackendStaffMember }>("/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setStaffStatus(userId: string, status: "active" | "disabled") {
  return apiRequest<{ item: BackendStaffMember }>(`/staff/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
