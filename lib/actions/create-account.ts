"use server";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateVerificationCode, hashValue } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send-email";
import { parseForm, signupSchema } from "@/lib/validation/schemas";
import type { ActionResult } from "./types";

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const GENERIC_ACCOUNT_ERROR = "Unable to create account with this email";

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signupSchema, formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });

      if (existing?.emailVerified) {
        return { status: "email-verified" as const };
      }

      if (existing) {
        // FR-1.8: overwrite the pending unverified record instead of rejecting.
        await tx.user.update({
          where: { id: existing.id },
          data: { name, passwordHash },
        });
        await tx.verificationCode.deleteMany({ where: { userId: existing.id } });
      } else {
        await tx.user.create({
          data: { name, email, passwordHash },
        });
      }

      const user = await tx.user.findUniqueOrThrow({ where: { email } });
      const code = generateVerificationCode();

      await tx.verificationCode.create({
        data: {
          userId: user.id,
          codeHash: hashValue(code),
          expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
        },
      });

      return { status: "created" as const, userId: user.id, code };
    });

    if (result.status === "email-verified") {
      return { error: GENERIC_ACCOUNT_ERROR };
    }

    try {
      await sendEmail(email, "verification-code", { code: result.code });
    } catch (err) {
      console.error("[create-account] failed to send verification email", err);
      return { redirectUrl: `/verify-email?userId=${result.userId}&notice=email-failed` };
    }

    return { redirectUrl: `/verify-email?userId=${result.userId}` };
  } catch (error) {
    console.error("Create account error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
