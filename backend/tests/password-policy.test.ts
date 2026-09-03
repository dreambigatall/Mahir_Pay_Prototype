import { describe, expect, it } from "vitest";

import { passwordSchema } from "../src/shared/validation/password-policy";

describe("password policy", () => {
  it("accepts a sufficiently strong password", () => {
    expect(passwordSchema.safeParse("Clinic-Secure-42").success).toBe(true);
  });

  it.each(["short", "alllowercase123!", "ALLUPPERCASE123!", "NoNumbersHere!", "NoSymbolsHere123"])(
    "rejects weak password %s",
    (password) => expect(passwordSchema.safeParse(password).success).toBe(false),
  );
});
