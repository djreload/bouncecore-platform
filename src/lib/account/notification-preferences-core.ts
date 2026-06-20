export const notificationPreferenceCategories = [
  {
    key: "stream",
    label: "Stream alerts",
    description: "Live stream start alerts."
  },
  {
    key: "purchases",
    label: "Purchases and orders",
    description: "Shop, music, stars, and fulfilment updates."
  },
  {
    key: "producer",
    label: "Producer activity",
    description: "Track sales and payout updates."
  },
  {
    key: "account",
    label: "Account and security",
    description: "Account, login, and security updates."
  },
  {
    key: "chat",
    label: "Chat mentions",
    description: "Replies and mentions from live and community chat."
  },
  {
    key: "admin",
    label: "Admin notices",
    description: "Direct notices sent by the site team."
  }
] as const;

export type NotificationPreferenceCategory = (typeof notificationPreferenceCategories)[number]["key"];
export type NotificationPreferenceChannel = "email" | "push";
export type NotificationChannelPreferences = Record<NotificationPreferenceChannel, boolean>;
export type NotificationPreferences = Record<NotificationPreferenceCategory, NotificationChannelPreferences>;

export function defaultNotificationPreferences(): NotificationPreferences {
  return notificationPreferenceCategories.reduce((preferences, category) => {
    preferences[category.key] = {
      email: true,
      push: true
    };

    return preferences;
  }, {} as NotificationPreferences);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeNotificationPreferences(value: unknown): NotificationPreferences {
  const defaults = defaultNotificationPreferences();

  if (!isRecord(value)) {
    return defaults;
  }

  const merged = defaultNotificationPreferences();

  for (const category of notificationPreferenceCategories) {
    const categoryValue = value[category.key];

    if (!isRecord(categoryValue)) {
      continue;
    }

    merged[category.key] = {
      email: typeof categoryValue.email === "boolean" ? categoryValue.email : defaults[category.key].email,
      push: typeof categoryValue.push === "boolean" ? categoryValue.push : defaults[category.key].push
    };
  }

  return merged;
}

export function notificationPreferenceCategoryForType(type: string): NotificationPreferenceCategory {
  const normalized = type.trim().toLowerCase();

  if (normalized.startsWith("stream.")) {
    return "stream";
  }

  if (normalized.startsWith("producer.")) {
    return "producer";
  }

  if (
    normalized.startsWith("shop.") ||
    normalized.startsWith("music.") ||
    normalized.startsWith("stars.") ||
    normalized.startsWith("order.")
  ) {
    return "purchases";
  }

  if (normalized.startsWith("admin.") || normalized.startsWith("notifications.admin")) {
    return "admin";
  }

  if (normalized.startsWith("chat.")) {
    return "chat";
  }

  return "account";
}

export function notificationDeliveryPreferences(
  preferences: NotificationPreferences,
  type: string
): NotificationChannelPreferences & { category: NotificationPreferenceCategory } {
  const category = notificationPreferenceCategoryForType(type);

  return {
    category,
    email: preferences[category].email,
    push: preferences[category].push
  };
}

export function notificationPreferenceEnabled(
  preferences: NotificationPreferences,
  type: string,
  channel: NotificationPreferenceChannel
) {
  return notificationDeliveryPreferences(preferences, type)[channel];
}
