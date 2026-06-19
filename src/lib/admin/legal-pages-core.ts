export const legalPageKeys = ["privacy", "terms", "cookies"] as const;

export type LegalPageKey = (typeof legalPageKeys)[number];

export type LegalPageSettings = {
  body: string;
  enabled: boolean;
  href: string;
  key: LegalPageKey;
  title: string;
};

export type LegalPageInput = {
  body?: string;
  enabled: boolean;
  key: string;
  title?: string;
};

const legalPageDefaults = [
  {
    body:
      "Bouncecore stores account details, profile information, purchases, downloads, chat activity, stream interactions, and device notification tokens where needed to run the platform.\n\nPayment details are handled by PayPal. Bouncecore stores payment references, order status, and fulfilment records, but does not store full card details.\n\nUploaded files, chat messages, moderation reports, support requests, and account actions may be reviewed by authorised staff to operate the service, investigate abuse, process purchases, and keep the community safe.\n\nYou can contact the site operator using the public support details shown on this site.",
    enabled: true,
    href: "/privacy",
    key: "privacy",
    title: "Privacy Policy"
  },
  {
    body:
      "By using Bouncecore, you agree to use the platform lawfully and respectfully. You are responsible for the content you upload, send, stream, purchase, or publish through your account.\n\nDo not upload or share material that you do not have permission to use. Do not harass other users, attempt to bypass moderation, interfere with the stream service, or abuse payments, downloads, chat, stickers, GIFs, stars, or notifications.\n\nDigital music downloads, merch orders, star purchases, and other paid features are processed through the platform checkout flows. Availability, fulfilment, and refund handling may depend on the specific product, track, producer, or payment status.\n\nBouncecore may restrict accounts, remove content, revoke chat access, or block purchases where required to protect the platform and its users.",
    enabled: true,
    href: "/terms",
    key: "terms",
    title: "Terms of Use"
  },
  {
    body:
      "Bouncecore uses essential cookies and local storage for sign-in sessions, security, account preferences, cart state, chat behaviour, and app/web functionality.\n\nThird-party providers may set cookies or similar identifiers when their services are used, including payment processing, embedded media, analytics, ads, push notifications, GIF search, or other integrations enabled by the site operator.\n\nBlocking essential cookies may prevent login, purchases, chat, downloads, or other account features from working correctly.",
    enabled: true,
    href: "/cookies",
    key: "cookies",
    title: "Cookie Policy"
  }
] as const satisfies readonly LegalPageSettings[];

const legalPageKeySet = new Set<string>(legalPageKeys);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isLegalPageKey(value: string): value is LegalPageKey {
  return legalPageKeySet.has(value);
}

function normalizedRequiredText(value: string | undefined, maxLength: number, label: string) {
  const text = value?.trim() ?? "";

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

export function defaultLegalPages(): LegalPageSettings[] {
  return legalPageDefaults.map((page) => ({ ...page }));
}

export function mergeLegalPages(value: unknown): LegalPageSettings[] {
  const savedPages = Array.isArray(value) ? value : [];

  return legalPageDefaults.map((definition) => {
    const saved = savedPages.find((item) => isObject(item) && item.key === definition.key);

    if (!isObject(saved)) {
      return { ...definition };
    }

    return {
      ...definition,
      body: typeof saved.body === "string" && saved.body.trim() ? saved.body.trim().slice(0, 8000) : definition.body,
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : definition.enabled,
      title: typeof saved.title === "string" && saved.title.trim() ? saved.title.trim().slice(0, 80) : definition.title
    };
  });
}

export function normalizeLegalPagesInput(input: LegalPageInput[]) {
  const pages = input.map((page) => {
    if (!isLegalPageKey(page.key)) {
      throw new Error("Unknown legal page setting.");
    }

    const definition = legalPageDefaults.find((item) => item.key === page.key);

    return {
      body: normalizedRequiredText(page.body, 8000, `${definition?.title ?? "Legal page"} body`),
      enabled: page.enabled,
      href: definition?.href ?? `/${page.key}`,
      key: page.key,
      title: normalizedRequiredText(page.title, 80, `${definition?.title ?? "Legal page"} title`)
    };
  });

  const missingKeys = legalPageKeys.filter((key) => !pages.some((page) => page.key === key));

  if (missingKeys.length > 0) {
    throw new Error("All legal page settings must be submitted.");
  }

  return pages;
}

export function legalPageForKey(pages: LegalPageSettings[], key: LegalPageKey) {
  return pages.find((page) => page.key === key) ?? defaultLegalPages().find((page) => page.key === key) ?? null;
}
