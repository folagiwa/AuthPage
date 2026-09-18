"use server";

import { prisma } from "@/lib/db/prisma";
import { resetPasswordSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { hashValue } from "@/lib/auth/tokens";
import { deleteAllSessionsForUser } from "@/lib/auth/session";

import type { ActionResult } from "./types";

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const data = Object.fromEntries(formData.entries());

  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const { password } = parsed.data;
  const token = data.token as string;
  const tokenHash = hashValue(token);

  try {
    // Check if token exists, is unexpired, and unused
    const dbToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!dbToken || dbToken.used || dbToken.expiresAt < new Date()) {
      return { error: "Reset link is invalid or has expired." };
    }

    // Update user password and invalidate all active sessions
    const newPasswordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      // 1. Mark token as used
      await tx.passwordResetToken.update({
        where: { id: dbToken.id },
        data: { used: true },
      });

      // 2. Update user's password
      await tx.user.update({
        where: { id: dbToken.userId },
        data: { passwordHash: newPasswordHash },
      });
    });

    // 3. Delete all active sessions
    await deleteAllSessionsForUser(dbToken.userId);

    return { redirectUrl: "/signin?reset=success" };
  } catch (error) {
    console.error("Reset password error:", error);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Validates a token for the initial page load of /reset-password.
 */
export async function validateResetToken(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashValue(token);
  try {
    const dbToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!dbToken || dbToken.used || dbToken.expiresAt < new Date()) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}
