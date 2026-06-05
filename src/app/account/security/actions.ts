"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getSessionTokenHash } from "@/lib/auth/session";
import { revokeAccountSession, revokeOtherAccountSessions } from "@/lib/auth/session-management";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function revokeAccountSessionAction(formData: FormData) {
  const user = await requireSignedInUser();

  await revokeAccountSession(formString(formData, "sessionId"), user.id, await getSessionTokenHash());
  revalidatePath("/account/security");
  revalidatePath("/admin/audit-logs");
}

export async function revokeOtherAccountSessionsAction() {
  const user = await requireSignedInUser();

  await revokeOtherAccountSessions(user.id, await getSessionTokenHash());
  revalidatePath("/account/security");
  revalidatePath("/admin/audit-logs");
}
