"use server";

import bcrypt from "bcrypt";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { generateVerificationCode, hashValue } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send-email";
import { parseForm, signinSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "./types";

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const GENERIC_CREDENTIALS_ERROR = "Invalid email or password";
const RATE_LIMIT_ERROR = "Too many attempts. Please try again later.";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "invalid-password-placeholder",
  10
);

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signinSchema, formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const { email, password } = parsed.data;

  try {
    const ip = await getClientIp();
    const rate = await enforceRateLimit({ action: "signin", ip, email });
    if (!rate.allowed) {
      return { error: RATE_LIMIT_ERROR };
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run bcrypt to keep the response time constant whether or not the
    // email exists, preventing timing-based user enumeration (PRD Section 9).
    const passwordValid = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH
    );

    if (!user || !passwordValid) {
      return { error: GENERIC_CREDENTIALS_ERROR };
    }

    if (!user.emailVerified) {
      // FR-2.3: reuse an unexpired code if one already exists.
      const existingCode = await prisma.verificationCode.findFirst({
        where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      });

      if (existingCode) {
        return { redirectUrl: `/verify-email?userId=${user.id}&notice=already-sent` };
      }

      const code = generateVerificationCode();
      await prisma.$transaction([
        prisma.verificationCode.deleteMany({ where: { userId: user.id } }),
        prisma.verificationCode.create({
          data: {
            userId: user.id,
            codeHash: hashValue(code),
            expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
          },
        }),
      ]);

      try {
        await sendEmail(user.email, "verification-code", { code });
      } catch (err) {
        console.error("[sign-in] failed to send verification email", err);
        return { redirectUrl: `/verify-email?userId=${user.id}&notice=email-failed` };
      }

      return { redirectUrl: `/verify-email?userId=${user.id}` };
    }

    await createSession(user.id);
    return { redirectUrl: "/dashboard" };
  } catch (error) {
    console.error("Sign in error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
