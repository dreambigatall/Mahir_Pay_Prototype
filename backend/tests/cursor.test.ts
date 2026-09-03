import { describe, expect, it } from "vitest";

import { AppError } from "../src/shared/errors/app-error";
import { decodeCursor, encodeCursor } from "../src/shared/pagination/cursor";

describe("timestamp cursor", () => {
  it("round-trips an opaque pagination position", () => {
    const cursor = { createdAt: "2026-08-28T10:00:00.000Z", id: "91a7582a-2882-47bf-9398-ab283119285b" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors with a public validation error", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrowError(AppError);
    try {
      decodeCursor("not-a-cursor");
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "CURSOR_INVALID" });
    }
  });
});
