import { randomUUID } from "node:crypto";

import type { RequestMetadata } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import { AppError } from "../../shared/errors/app-error";
import { hashPassword, verifyPassword } from "../../shared/security/password";
import { generateSessionToken, hashSessionToken } from "../../shared/security/session-token";
import type { AuthStore } from "./auth.repository";
import type { UserWithAccess } from "./auth.types";

export type PublicUser = Omit<UserWithAccess, "password_hash" | "failed_login_count" | "locked_until">;

export type LoginResult = {
  token: string;
  expiresAt: Date;
  user: PublicUser;
};

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly audit: AuditRepository,
    private readonly options: {
      passwordPepper: string;
      sessionTtlHours: number;
      sessionIdleMinutes: number;
    },
  ) {}

  async login(emailInput: string, password: string, metadata: RequestMetadata): Promise<LoginResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.store.findUserByEmail(email);
    const validPassword = user
      ? await verifyPassword(user.password_hash, password, this.options.passwordPepper)
      : false;

    const isLocked = Boolean(user?.locked_until && user.locked_until > new Date());
    if (!user || !validPassword || user.status !== "active" || isLocked) {
      await this.store.recordFailedLogin(user, email, metadata);
      await this.audit.record({
        ...metadata,
        actorUserId: user?.id,
        action: "auth.login_failed",
        resourceType: "session",
        metadata: { email },
      });
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const token = generateSessionToken();
    const now = Date.now();
    const expiresAt = new Date(now + this.options.sessionTtlHours * 60 * 60 * 1_000);
    const idleExpiresAt = new Date(
      Math.min(expiresAt.getTime(), now + this.options.sessionIdleMinutes * 60 * 1_000),
    );
    const sessionId = randomUUID();

    await this.store.recordSuccessfulLogin(user.id, email, metadata);
    await this.store.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      idleExpiresAt,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    await this.audit.record({
      ...metadata,
      actorUserId: user.id,
      action: "auth.login_succeeded",
      resourceType: "session",
      resourceId: sessionId,
    });

    return { token, expiresAt, user: toPublicUser(user) };
  }

  async logout(sessionId: string, userId: string, metadata: RequestMetadata): Promise<void> {
    await this.store.revokeSession(sessionId);
    await this.audit.record({
      ...metadata,
      actorUserId: userId,
      action: "auth.logout",
      resourceType: "session",
      resourceId: sessionId,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.store.findUserById(userId);
    if (!user || !(await verifyPassword(user.password_hash, currentPassword, this.options.passwordPepper))) {
      throw new AppError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
    }
    if (currentPassword === newPassword) {
      throw new AppError(400, "PASSWORD_UNCHANGED", "New password must differ from the current password");
    }

    const passwordHash = await hashPassword(newPassword, this.options.passwordPepper);
    await this.store.changePasswordAndRevokeSessions(userId, passwordHash);
    await this.audit.record({
      ...metadata,
      actorUserId: userId,
      action: "auth.password_changed",
      resourceType: "user",
      resourceId: userId,
    });
  }
}

function toPublicUser(user: UserWithAccess): PublicUser {
  const { password_hash: _passwordHash, failed_login_count: _failedCount, locked_until: _lockedUntil, ...safe } =
    user;
  return safe;
}
