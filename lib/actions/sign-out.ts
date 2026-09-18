"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function signOut() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await deleteSession(sessionId);
  }
  redirect("/signin");
}
