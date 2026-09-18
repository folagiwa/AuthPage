import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export type RateLimitAction =
  | "signin"
  | "forgot-password"
  | "verify-code"
  | "resend-code";

const LIMITS: Record<RateLimitAction, { limit: number; windowSeconds: number }> =
  {
    signin: { limit: 5, windowSeconds: 15 * 60 },
    "forgot-password": { limit: 3, windowSeconds: 60 * 60 },
    "verify-code": { limit: 5, windowSeconds: 15 * 60 },
    "resend-code": { limit: 3, windowSeconds: 60 * 60 },
  };

export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headerList.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

async function incrementKey(params: {
  key: string;
  action: RateLimitAction;
  windowSeconds: number;
  userId?: string;
}): Promise<number> {
  const id = randomBytes(16).toString("hex");

  const rows = await prisma.$queryRaw<Array<{ attemptCount: number }>>`
    INSERT INTO "RateLimitEntry" ("id", "key", "action", "userId", "attemptCount", "windowStart")
    VALUES (${id}, ${params.key}, ${params.action}, ${params.userId ?? null}, 1, now())
    ON CONFLICT ("key", "action") DO UPDATE SET
      "attemptCount" = CASE
        WHEN "RateLimitEntry"."windowStart" <= now() - make_interval(secs => ${params.windowSeconds}::int) THEN 1
        ELSE "RateLimitEntry"."attemptCount" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitEntry"."windowStart" <= now() - make_interval(secs => ${params.windowSeconds}::int) THEN now()
        ELSE "RateLimitEntry"."windowStart"
      END
    RETURNING "attemptCount"
  `;

  return rows[0]?.attemptCount ?? 1;
}

export async function enforceRateLimit(params: {
  action: RateLimitAction;
  ip: string;
  email?: string;
  userId?: string;
}): Promise<{ allowed: boolean }> {
  const { action, ip, email, userId } = params;
  const { limit, windowSeconds } = LIMITS[action];

  const ipAttempts = await incrementKey({
    key: `ip:${ip}`,
    action,
    windowSeconds,
  });
  if (ipAttempts > limit) {
    return { allowed: false };
  }

  if (email) {
    const emailAttempts = await incrementKey({
      key: `email:${email.toLowerCase()}`,
      action,
      windowSeconds,
      userId,
    });
    if (emailAttempts > limit) {
      return { allowed: false };
    }
  }

  return { allowed: true };
}
