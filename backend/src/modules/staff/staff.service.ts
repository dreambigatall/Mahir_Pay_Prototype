import { AppError } from "../../shared/errors/app-error";
import { hashPassword } from "../../shared/security/password";
import type { RequestMetadata } from "../audit/audit.repository";
import { StaffRepository } from "./staff.repository";
import type { StaffMember } from "./staff.types";

export class StaffService {
  constructor(
    private readonly repository: StaffRepository,
    private readonly passwordPepper: string,
  ) {}

  list(page: number, pageSize: number): Promise<{ items: StaffMember[]; total: number }> {
    return this.repository.list(pageSize, (page - 1) * pageSize);
  }

  listRoles() {
    return this.repository.listRoles();
  }

  listDoctors() {
    return this.repository.listDoctors();
  }

  async create(
    actorUserId: string,
    input: {
      email: string;
      temporaryPassword: string;
      fullName: string;
      title?: string;
      room?: string;
      roles: string[];
    },
    metadata: RequestMetadata,
  ): Promise<StaffMember> {
    try {
      return await this.repository.create(
        {
          email: input.email.trim().toLowerCase(),
          passwordHash: await hashPassword(input.temporaryPassword, this.passwordPepper),
          fullName: input.fullName,
          title: input.title,
          room: input.room,
          roleSlugs: input.roles,
          assignedBy: actorUserId,
        },
        { ...metadata, actorUserId, action: "staff.created", resourceType: "user" },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "EMAIL_IN_USE", "A staff account already uses this email");
      }
      throw error;
    }
  }

  setStatus(
    actorUserId: string,
    userId: string,
    status: "active" | "disabled",
    metadata: RequestMetadata,
  ): Promise<StaffMember> {
    if (actorUserId === userId && status === "disabled") {
      throw new AppError(400, "SELF_DISABLE_NOT_ALLOWED", "You cannot disable your own account");
    }
    return this.repository.setStatus(userId, status, {
      ...metadata,
      actorUserId,
      action: `staff.${status}`,
      resourceType: "user",
    });
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
