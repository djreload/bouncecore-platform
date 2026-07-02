import type { CurrentUser } from "@/lib/auth/rbac";
import {
  normalizePrivacyRightsRequest,
  type PrivacyRightsRequestInput
} from "@/lib/privacy/privacy-rights-core";
import { createSupportRequest, type SupportRequestContext } from "@/lib/support/support-service";

type PrivacyRightsRequestContext = Omit<SupportRequestContext, "source"> & {
  source?: string;
  user?: CurrentUser | null;
};

export async function createPrivacyRightsRequest(input: PrivacyRightsRequestInput, context: PrivacyRightsRequestContext = {}) {
  const normalized = normalizePrivacyRightsRequest(
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
    source: context.source ?? "privacy-rights"
  });
}
