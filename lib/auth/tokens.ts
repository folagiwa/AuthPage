import { createHash, randomBytes, randomInt } from "node:crypto";

export function generateVerificationCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
