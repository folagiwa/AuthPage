"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { hashValue, generateVerificationCode } from "@/lib/auth/tokens";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/email/send-email";

export type ResendCodeState = {
  success?: boolean;
  error?: string;
};

export async function resendCode(formData: FormData): Promise<ResendCodeState> {
  const userId = formData.get("userId") as string;

  if (!userId) {
    return { error: "Missing user information. Please try signing in again." };
  }

  const ip = await getClientIp();

  // Rate Limiting
  const rate = await enforceRateLimit({ action: "resend-code", ip, email: userId });
  if (!rate.allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.emailVerified) {
      return { error: "User not found or already verified." };
    }

    // Generate new code
    const code = generateVerificationCode();
    const codeHash = hashValue(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.$transaction(async (tx) => {
      // Invalidate existing codes
      await tx.verificationCode.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      // Create new code
      await tx.verificationCode.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
        },
      });
    });

    try {
      await sendEmail(user.email, "verification-code", { code });
      return { success: true };
    } catch (err) {
      console.error("Failed to resend email", err);
      return { error: "Couldn't send the email. Please try again." };
    }
  } catch (error) {
    console.error("Resend code error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
