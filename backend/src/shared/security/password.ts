import argon2 from "argon2";

export async function hashPassword(password: string, pepper: string): Promise<string> {
  return argon2.hash(`${password}${pepper}`, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
  pepper: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, `${password}${pepper}`);
  } catch {
    return false;
  }
}
