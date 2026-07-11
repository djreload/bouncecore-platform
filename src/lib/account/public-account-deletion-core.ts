import { accountDeletionConfirmationText } from "@/lib/account/account-deletion-core";
import type { SupportRequestInput } from "@/lib/support/support-request-core";

export type PublicAccountDeletionRequestInput = {
  confirmation?: string;
  email?: string;
  name?: string;
  reason?: string;
};

export type PublicAccountDeletionRequester = {
  displayName: string;
  email: string;
} | null;

export type NormalizedPublicAccountDeletionRequest = {
  supportRequest: SupportRequestInput;
};

function normalizeOptionalText(value: string | undefined, maxLength: number, label: string) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizePublicDeletionEmail(value: string | undefined, fallbackEmail?: string) {
  const email = (value?.trim() || fallbackEmail || "").toLowerCase();

  if (!email) {
    throw new Error("Email is required.");
  }

  if (email.length > 255) {
    throw new Error("Email must be 255 characters or fewer.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email.");
  }

  return email;
}

export function normalizePublicAccountDeletionRequest(
  input: PublicAccountDeletionRequestInput,
  requester: PublicAccountDeletionRequester = null
): NormalizedPublicAccountDeletionRequest {
  const confirmation = input.confirmation?.trim() ?? "";

  if (confirmation !== accountDeletionConfirmationText) {
    throw new Error(`Type ${accountDeletionConfirmationText} to confirm the account deletion request.`);
  }

  const email = normalizePublicDeletionEmail(input.email, requester?.email);
  const name = normalizeOptionalText(input.name, 120, "Name") ?? requester?.displayName ?? null;
  const reason = normalizeOptionalText(input.reason, 1000, "Reason");
  const requesterLine = requester
    ? `Requester signed in as ${requester.displayName} <${requester.email}>.`
    : "Requester was not signed in. Verify account ownership before deleting related data.";

  const message = [
    `Public account deletion request for ${email}.`,
    requesterLine,
    name ? `Requester name: ${name}.` : "Requester name: Not provided.",
    reason ? `Requester reason: ${reason}` : "Requester reason: Not provided.",
    "This public form does not prove account ownership by itself. Staff must verify identity before deleting or anonymising account data.",
    "Retain only records required for security, fraud prevention, payment, tax, or legal obligations."
  ].join("\n\n");

  return {
    supportRequest: {
      category: "account",
      email,
      message,
      name: name ?? undefined,
      priority: "high",
      subject: "Public account deletion request"
    }
  };
}
