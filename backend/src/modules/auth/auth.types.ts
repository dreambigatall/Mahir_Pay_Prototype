export type UserStatus = "active" | "disabled" | "locked";

export type UserWithAccess = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  title: string | null;
  room: string | null;
  status: UserStatus;
  must_change_password: boolean;
  failed_login_count: number;
  locked_until: Date | null;
  roles: string[];
  permissions: string[];
};

export type SessionPrincipal = {
  session_id: string;
  user_id: string;
  email: string;
  full_name: string;
  title: string | null;
  room: string | null;
  must_change_password: boolean;
  roles: string[];
  permissions: string[];
};

export type SessionCreation = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};
