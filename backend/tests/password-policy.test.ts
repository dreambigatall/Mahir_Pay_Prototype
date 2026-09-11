import { describe, expect, it } from "vitest";

import { passwordSchema } from "../src/shared/validation/password-policy";

describe("password policy", () => {
  it("accepts passwords of at least 6 characters with no complexity rules", () => {
    expect(passwordSchema.safeParse("123456").success).toBe(true);
    expect(passwordSchema.safeParse("abcdef").success).toBe(true);
    expect(passwordSchema.safeParse("Clinic42").success).toBe(true);
  });

  it("rejects passwords shorter than 6 characters", () => {
    expect(passwordSchema.safeParse("12345").success).toBe(false);
    expect(passwordSchema.safeParse("abc").success).toBe(false);
    expect(passwordSchema.safeParse("").success).toBe(false);
  });
});
