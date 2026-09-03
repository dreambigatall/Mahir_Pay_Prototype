import { describe, expect, it, vi } from "vitest";

import type { AuthStore } from "../src/modules/auth/auth.repository";
import { AuthService } from "../src/modules/auth/auth.service";
import type { UserWithAccess } from "../src/modules/auth/auth.types";
import type { AuditRepository } from "../src/modules/audit/audit.repository";
import { AppError } from "../src/shared/errors/app-error";
import { hashPassword } from "../src/shared/security/password";

const pepper = "test-pepper-that-is-at-least-thirty-two-characters";
const metadata = { requestId: "ed9f2ec2-2d78-4a19-b5b1-7fc38b029165" };

function createStore(user: UserWithAccess | null): AuthStore {
  return {
    findUserByEmail: vi.fn().mockResolvedValue(user),
    findUserById: vi.fn().mockResolvedValue(user),
    recordFailedLogin: vi.fn().mockResolvedValue(undefined),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(undefined),
    findPrincipalByTokenHash: vi.fn().mockResolvedValue(null),
    touchSession: vi.fn().mockResolvedValue(undefined),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    changePasswordAndRevokeSessions: vi.fn().mockResolvedValue(undefined),
  };
}

function createAudit(): AuditRepository {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditRepository;
}

describe("AuthService", () => {
  it("creates an opaque server-side session after valid credentials", async () => {
    const user: UserWithAccess = {
      id: "cc966a2b-e6c2-42a9-a28a-c55472f03b42",
      email: "admin@clinic.test",
      password_hash: await hashPassword("Clinic-Secure-42", pepper),
      full_name: "Clinic Admin",
      title: null,
      room: null,
      status: "active",
      must_change_password: true,
      failed_login_count: 0,
      locked_until: null,
      roles: ["admin"],
      permissions: ["staff.manage"],
    };
    const store = createStore(user);
    const service = new AuthService(store, createAudit(), {
      passwordPepper: pepper,
      sessionTtlHours: 12,
      sessionIdleMinutes: 30,
    });

    const result = await service.login(user.email, "Clinic-Secure-42", metadata);

    expect(result.token.length).toBeGreaterThan(30);
    expect(result.user).not.toHaveProperty("password_hash");
    expect(store.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id, tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    );
  });

  it("returns the same public error for an unknown account", async () => {
    const store = createStore(null);
    const service = new AuthService(store, createAudit(), {
      passwordPepper: pepper,
      sessionTtlHours: 12,
      sessionIdleMinutes: 30,
    });

    await expect(service.login("missing@clinic.test", "wrong", metadata)).rejects.toMatchObject<Partial<AppError>>({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(store.recordFailedLogin).toHaveBeenCalled();
  });

  it("revokes all sessions when the password changes", async () => {
    const user = {
      id: "cc966a2b-e6c2-42a9-a28a-c55472f03b42",
      email: "admin@clinic.test",
      password_hash: await hashPassword("Clinic-Secure-42", pepper),
      full_name: "Clinic Admin",
      title: null,
      room: null,
      status: "active" as const,
      must_change_password: false,
      failed_login_count: 0,
      locked_until: null,
      roles: ["admin"],
      permissions: ["staff.manage"],
    };
    const store = createStore(user);
    const service = new AuthService(store, createAudit(), {
      passwordPepper: pepper,
      sessionTtlHours: 12,
      sessionIdleMinutes: 30,
    });

    await service.changePassword(user.id, "Clinic-Secure-42", "Clinic-NewSecure-43!", metadata);
    expect(store.changePasswordAndRevokeSessions).toHaveBeenCalledWith(user.id, expect.stringMatching(/^\$argon2id\$/));
  });
});
