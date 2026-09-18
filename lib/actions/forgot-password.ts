"use server";

import { prisma } from "@/lib/db/prisma";
import { generateResetToken, hashValue } from "@/lib/auth/tokens";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/email/send-email";
import { forgotPasswordSchema, parseForm } from "@/lib/validation/schemas";
import type { ActionResult } from "./types";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT_ERROR = "Too many attempts. Please try again later.";

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const { email } = parsed.data;

  const ip = await getClientIp();
  const rate = await enforceRateLimit({ action: "forgot-password", ip, email });
  if (!rate.allowed) {
    return { error: RATE_LIMIT_ERROR };
  }

  // FR-3.3: only send a reset link when the account exists and is verified.
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.emailVerified) {
    const token = generateResetToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashValue(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      await sendEmail(user.email, "reset-link", { resetUrl });
    } catch (err) {
      // FR-3.2: never reveal whether the account exists, including on email
      // delivery failure. Log server-side only.
      console.error("[forgot-password] failed to send reset email", err);
    }
  }

  // FR-3.2: identical response whether or not the account exists.
  return {};
}
