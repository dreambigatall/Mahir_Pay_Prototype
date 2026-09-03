import type { UserStatus } from "../auth/auth.types";

export type StaffMember = {
  id: string;
  email: string;
  full_name: string;
  title: string | null;
  room: string | null;
  status: UserStatus;
  must_change_password: boolean;
  roles: string[];
  created_at: Date;
  updated_at: Date;
};

export type Role = {
  slug: string;
  name: string;
  description: string | null;
};

export type CreateStaffInput = {
  email: string;
  passwordHash: string;
  fullName: string;
  title?: string;
  room?: string;
  roleSlugs: string[];
  assignedBy: string;
};
