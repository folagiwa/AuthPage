"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { verifyEmailSchema } from "@/lib/validation/schemas";
import { hashValue } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import type { ActionResult } from "./types";

export async function verifyEmail(formData: FormData): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());
  const userId = data.userId as string;

  if (!userId) {
    return { error: "Missing user information. Please try signing in again." };
  }

  const parsed = verifyEmailSchema.safeParse(data);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const { code } = parsed.data;
  const codeHash = hashValue(code);

  const ip = await getClientIp();

  // Rate Limiting
  const rate = await enforceRateLimit({ action: "verify-code", ip, email: userId });

  if (!rate.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: "User not found." };
    }

    // Check for matching unexpired code
    const existingCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        codeHash,
        used: false,
      },
    });

    if (!existingCode) {
      return { error: "Incorrect verification code." };
    }

    if (existingCode.expiresAt < new Date()) {
      return { error: "Verification code has expired. Please request a new one." };
    }

    // Valid code -> verify user and create session
    await prisma.$transaction(async (tx) => {
      // Mark code as used
      await tx.verificationCode.update({
        where: { id: existingCode.id },
        data: { used: true },
      });

      // Update user
      await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    });

    await createSession(user.id);
    return { redirectUrl: "/dashboard" };
  } catch (error) {
    console.error("Verify email error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}
