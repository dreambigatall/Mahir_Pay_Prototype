import { AppError } from "../errors/app-error";

export type TimestampCursor = { createdAt: string; id: string };

export function encodeCursor(cursor: TimestampCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string | undefined): TimestampCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error("Malformed cursor");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new AppError(400, "CURSOR_INVALID", "Pagination cursor is invalid");
  }
}
