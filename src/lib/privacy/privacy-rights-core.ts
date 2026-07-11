import type { SupportRequestInput } from "@/lib/support/support-request-core";

export const privacyRightsRequestTypes = [
  "access",
  "correction",
  "portability",
  "deletion",
  "restriction",
  "objection",
  "consent",
  "other"
] as const;

export type PrivacyRightsRequestType = (typeof privacyRightsRequestTypes)[number];

export type PrivacyRightsRequestInput = {
  email?: string;
  message?: string;
  name?: string;
  requestType?: string;
};

export type PrivacyRightsRequester = {
  displayName: string;
  email: string;
} | null;

export type NormalizedPrivacyRightsRequest = {
  requestType: PrivacyRightsRequestType;
  supportRequest: SupportRequestInput;
};

const requestTypeLabels: Record<PrivacyRightsRequestType, string> = {
  access: "Access my data",
  consent: "Consent or privacy preferences",
  correction: "Correct my data",
  deletion: "Delete my data",
  objection: "Object to processing",
  other: "Other privacy request",
  portability: "Export or transfer my data",
  restriction: "Restrict processing"
};

const priorityByRequestType: Record<PrivacyRightsRequestType, "high" | "normal"> = {
  access: "high",
  consent: "normal",
  correction: "high",
  deletion: "high",
  objection: "high",
  other: "normal",
  portability: "high",
  restriction: "high"
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

function normalizeRequiredText(value: string | undefined, maxLength: number, label: string) {
  const text = normalizeOptionalText(value, maxLength, label);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizePrivacyEmail(value: string | undefined, fallbackEmail?: string) {
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

function normalizePrivacyRequestType(value: string | undefined): PrivacyRightsRequestType {
  return privacyRightsRequestTypes.includes(value as PrivacyRightsRequestType) ? (value as PrivacyRightsRequestType) : "other";
}

export function privacyRightsRequestTypeLabel(type: PrivacyRightsRequestType) {
  return requestTypeLabels[type];
}

export function normalizePrivacyRightsRequest(
  input: PrivacyRightsRequestInput,
  requester: PrivacyRightsRequester = null
): NormalizedPrivacyRightsRequest {
  const requestType = normalizePrivacyRequestType(input.requestType);
  const email = normalizePrivacyEmail(input.email, requester?.email);
  const name = normalizeOptionalText(input.name, 120, "Name") ?? requester?.displayName ?? null;
  const userMessage = normalizeRequiredText(input.message, 2000, "Message");
  const requesterLine = requester
    ? `Requester signed in as ${requester.displayName} <${requester.email}>.`
    : "Requester was not signed in. Verify identity before disclosing, exporting, deleting, or changing personal data.";

  const message = [
    `Privacy rights request for ${email}.`,
    `Request type: ${requestTypeLabels[requestType]}.`,
    requesterLine,
    name ? `Requester name: ${name}.` : "Requester name: Not provided.",
    `Requester message: ${userMessage}`,
    "Staff must verify identity before disclosing, exporting, deleting, correcting, or restricting personal data."
  ].join("\n\n");

  return {
    requestType,
    supportRequest: {
      category: "privacy",
      email,
      message,
      name: name ?? undefined,
      priority: priorityByRequestType[requestType],
      subject: `Privacy rights request: ${requestTypeLabels[requestType]}`
    }
  };
}
