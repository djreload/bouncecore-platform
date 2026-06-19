export const supportCategories = ["account", "stream", "chat", "orders", "music", "shop", "mobile", "other"] as const;
export const supportPriorities = ["normal", "high", "urgent"] as const;
export const supportStatuses = ["open", "reviewing", "waiting", "resolved", "dismissed"] as const;

export type SupportCategory = (typeof supportCategories)[number];
export type SupportPriority = (typeof supportPriorities)[number];
export type SupportStatus = (typeof supportStatuses)[number];

export type SupportRequestInput = {
  category?: string;
  email?: string;
  message?: string;
  name?: string;
  priority?: string;
  subject?: string;
};

function normalizedOptionalText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedRequiredText(value: string | undefined, maxLength: number, label: string) {
  const text = normalizedOptionalText(value, maxLength);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizeSupportEmailAddress(value: string) {
  const email = value.trim().toLowerCase();

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

export function normalizeOption<T extends readonly string[]>(value: string | undefined, allowed: T, fallback: T[number]) {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

export function normalizeSupportRequestInput(input: SupportRequestInput, fallbackEmail?: string | null) {
  return {
    category: normalizeOption(input.category, supportCategories, "other"),
    email: normalizeSupportEmailAddress(input.email?.trim() || fallbackEmail || ""),
    message: normalizedRequiredText(input.message, 4000, "Message"),
    name: normalizedOptionalText(input.name, 120),
    priority: normalizeOption(input.priority, supportPriorities, "normal"),
    subject: normalizedRequiredText(input.subject, 140, "Subject")
  };
}

export function normalizeSupportResolutionNote(value: string | undefined) {
  return normalizedOptionalText(value, 1000);
}
