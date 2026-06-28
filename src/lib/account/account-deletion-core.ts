export const accountDeletionConfirmationText = "DELETE MY ACCOUNT";

export type AccountDeletionRequestInput = {
  confirmation?: string;
  reason?: string;
};

export type NormalizedAccountDeletionRequest = {
  message: string;
  reason: string | null;
};

function normalizedOptionalText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Reason must be ${maxLength} characters or fewer.`);
  }

  return text;
}

export function normalizeAccountDeletionRequest(input: AccountDeletionRequestInput, user: { displayName: string; email: string }) {
  const confirmation = input.confirmation?.trim() ?? "";

  if (confirmation !== accountDeletionConfirmationText) {
    throw new Error(`Type ${accountDeletionConfirmationText} to confirm the account deletion request.`);
  }

  const reason = normalizedOptionalText(input.reason, 1000);
  const message = [
    `Account deletion requested by ${user.displayName} <${user.email}>.`,
    "The operator must remove or anonymise personal data unless retention is required for security, fraud prevention, payment, tax, or legal obligations.",
    reason ? `User reason: ${reason}` : "User reason: Not provided."
  ].join("\n\n");

  return {
    message,
    reason
  } satisfies NormalizedAccountDeletionRequest;
}
