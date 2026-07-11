import type { CurrentUser } from "@/lib/auth/rbac";
import { createSupportRequest, type SupportRequestContext } from "@/lib/support/support-service";
import {
  normalizePublicAccountDeletionRequest,
  type PublicAccountDeletionRequestInput
} from "@/lib/account/public-account-deletion-core";

type PublicAccountDeletionContext = Omit<SupportRequestContext, "source"> & {
  source?: string;
  user?: CurrentUser | null;
};

export async function createPublicAccountDeletionRequest(
  input: PublicAccountDeletionRequestInput,
  context: PublicAccountDeletionContext = {}
) {
  const normalized = normalizePublicAccountDeletionRequest(
    input,
    context.user
      ? {
          displayName: context.user.displayName,
          email: context.user.email
        }
      : null
  );

  return createSupportRequest(normalized.supportRequest, {
    ...context,
    source: context.source ?? "public-account-deletion"
  });
}
