import { writeAuditLog } from "@/lib/auth/audit";
import type { CurrentUser } from "@/lib/auth/rbac";
import { normalizeAccountDeletionRequest, type AccountDeletionRequestInput } from "@/lib/account/account-deletion-core";
import { createSupportRequest } from "@/lib/support/support-service";

export async function requestAccountDeletion(user: CurrentUser, input: AccountDeletionRequestInput) {
  const normalized = normalizeAccountDeletionRequest(input, user);
  const request = await createSupportRequest(
    {
      category: "account",
      email: user.email,
      message: normalized.message,
      name: user.displayName,
      priority: "high",
      subject: "Account deletion request"
    },
    {
      source: "account-settings",
      user
    }
  );

  await writeAuditLog({
    actorId: user.id,
    action: "account.deletion.request",
    metadata: {
      supportRequestId: request.id
    },
    severity: "warning",
    target: `user:${user.id}`
  });

  return request;
}
