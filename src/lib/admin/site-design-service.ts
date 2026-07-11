import { Prisma } from "@prisma/client";
import type { CSSProperties } from "react";
import { publicNavigation, type IconName, type NavigationItem } from "@/config/navigation";
import {
  editableThemeTokenDefinitions,
  mergeThemeTokens,
  normalizeThemeInput,
  type EditableThemeToken,
  type SiteThemeInput
} from "@/lib/admin/site-theme-core";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

export type { EditableThemeToken, SiteThemeInput } from "@/lib/admin/site-theme-core";

const sitePagesSettingKey = "site.pages";
const siteMenusSettingKey = "site.menus";
const siteThemeSettingKey = "site.theme";

type BadgeTone = "cyan" | "pink" | "acid" | "amber" | "muted";

export type EditablePublicPage = {
  defaultDescription: string;
  defaultTitle: string;
  description: string;
  enabled: boolean;
  featured: boolean;
  href: string;
  icon: IconName;
  key: string;
  title: string;
  tone: BadgeTone;
};

export type EditablePublicMenuItem = {
  enabled: boolean;
  href: string;
  icon: IconName;
  key: string;
  label: string;
  order: number;
};

export type SitePagesInput = {
  pages: Array<{
    description?: string;
    enabled: boolean;
    featured: boolean;
    key: string;
    title?: string;
  }>;
};

export type SiteMenusInput = {
  items: Array<{
    enabled: boolean;
    key: string;
    label?: string;
    order?: number;
  }>;
};

export type AdminSitePagesData = {
  pages: EditablePublicPage[];
  source: "default" | "database";
  stats: {
    enabled: number;
    featured: number;
    total: number;
    updatedAt: string | null;
  };
};

export type AdminSiteMenusData = {
  items: EditablePublicMenuItem[];
  source: "default" | "database";
  stats: {
    enabled: number;
    total: number;
    updatedAt: string | null;
  };
};

export type AdminSiteThemeData = {
  source: "default" | "database";
  stats: {
    changed: number;
    total: number;
    updatedAt: string | null;
  };
  tokens: EditableThemeToken[];
};

export const editablePublicPageDefinitions = [
  {
    defaultDescription: "Main public landing page for Bouncecore.",
    defaultTitle: "Home",
    href: "/",
    icon: "home",
    key: "home",
    tone: "cyan"
  },
  {
    defaultDescription: "Stream pages, playback status, schedules, and live star support.",
    defaultTitle: "Live",
    href: "/live",
    icon: "radio",
    key: "live",
    tone: "cyan"
  },
  {
    defaultDescription: "Native rooms with moderation, badges, overlays, GIFs, and mobile-ready APIs.",
    defaultTitle: "Chat",
    href: "/chat",
    icon: "message",
    key: "chat",
    tone: "pink"
  },
  {
    defaultDescription: "Public DJ profile directory and streamer discovery.",
    defaultTitle: "DJs",
    href: "/djs",
    icon: "headphones",
    key: "djs",
    tone: "acid"
  },
  {
    defaultDescription: "Producer profile directory and marketplace creator discovery.",
    defaultTitle: "Producers",
    href: "/producers",
    icon: "music",
    key: "producers",
    tone: "amber"
  },
  {
    defaultDescription: "Producer tracks, approvals, licenses, previews, purchases, and downloads.",
    defaultTitle: "Music",
    href: "/music",
    icon: "star",
    key: "music",
    tone: "acid"
  },
  {
    defaultDescription: "Merch products, variants, orders, fulfilment, and payment audit trail.",
    defaultTitle: "Shop",
    href: "/shop",
    icon: "shopping-bag",
    key: "shop",
    tone: "amber"
  },
  {
    defaultDescription: "Star packages, live chat sending, stream alerts, and supporter leaderboards.",
    defaultTitle: "Star Support",
    href: "/rewards",
    icon: "star",
    key: "rewards",
    tone: "pink"
  },
  {
    defaultDescription: "Signed-in account dashboard, orders, downloads, rewards, and security.",
    defaultTitle: "Account",
    href: "/account",
    icon: "user",
    key: "account",
    tone: "cyan"
  },
  {
    defaultDescription: "Public help desk for account, stream, chat, shop, music, and mobile support requests.",
    defaultTitle: "Support",
    href: "/support",
    icon: "message",
    key: "support",
    tone: "pink"
  }
] as const satisfies Array<{
  defaultDescription: string;
  defaultTitle: string;
  href: string;
  icon: IconName;
  key: string;
  tone: BadgeTone;
}>;

const featuredPageDefaults = new Set(["live", "chat", "music", "shop"]);
const pageKeys: Set<string> = new Set(editablePublicPageDefinitions.map((page) => page.key));

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedText(value: string | undefined, maxLength: number, label: string) {
  const text = value?.trim() ?? "";

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function readSettingPayload(value: unknown, property: string) {
  if (!isObject(value)) {
    return {};
  }

  const payload = value[property];

  return isObject(payload) ? payload : {};
}

async function readAppSetting(key: string) {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key
    }
  });

  return {
    source: setting ? ("database" as const) : ("default" as const),
    updatedAt: setting?.updatedAt ?? null,
    value: setting?.value
  };
}

function mergePages(value: unknown): EditablePublicPage[] {
  const payload = readSettingPayload(value, "pages");

  return editablePublicPageDefinitions.map((definition) => {
    const saved = payload[definition.key];
    const page = isObject(saved) ? saved : {};

    return {
      ...definition,
      description:
        typeof page.description === "string" && page.description.trim()
          ? page.description.trim().slice(0, 260)
          : definition.defaultDescription,
      enabled: typeof page.enabled === "boolean" ? page.enabled : true,
      featured: typeof page.featured === "boolean" ? page.featured : featuredPageDefaults.has(definition.key),
      title:
        typeof page.title === "string" && page.title.trim()
          ? page.title.trim().slice(0, 80)
          : definition.defaultTitle
    };
  });
}

function mergeMenuItems(value: unknown): EditablePublicMenuItem[] {
  const payload = readSettingPayload(value, "public");

  return publicNavigation
    .map((item, index) => {
      const key = item.href === "/" ? "home" : item.href.replace(/^\//, "").replaceAll("/", "_");
      const saved = payload[key];
      const menuItem = isObject(saved) ? saved : {};

      return {
        enabled: typeof menuItem.enabled === "boolean" ? menuItem.enabled : true,
        href: item.href,
        icon: item.icon,
        key,
        label: typeof menuItem.label === "string" && menuItem.label.trim() ? menuItem.label.trim().slice(0, 40) : item.label,
        order: typeof menuItem.order === "number" && Number.isFinite(menuItem.order) ? Math.trunc(menuItem.order) : index + 1
      };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function normalizePagesInput(input: SitePagesInput) {
  const pages = input.pages.reduce<Record<string, { description: string; enabled: boolean; featured: boolean; title: string }>>(
    (settings, page) => {
      if (!pageKeys.has(page.key)) {
        throw new Error("Unknown page setting.");
      }

      return {
        ...settings,
        [page.key]: {
          description: normalizedText(page.description, 260, "Page description"),
          enabled: page.enabled,
          featured: page.featured,
          title: normalizedText(page.title, 80, "Page title")
        }
      };
    },
    {}
  );

  if (!Object.values(pages).some((page) => page.featured && page.enabled)) {
    throw new Error("At least one enabled page must be featured on the homepage.");
  }

  return {
    pages,
    version: 1
  };
}

function normalizeMenusInput(input: SiteMenusInput) {
  const allowedKeys = new Set(mergeMenuItems(null).map((item) => item.key));
  const publicItems = input.items.reduce<Record<string, { enabled: boolean; label: string; order: number }>>((settings, item) => {
    if (!allowedKeys.has(item.key)) {
      throw new Error("Unknown menu item.");
    }

    const order = Number.isFinite(item.order) ? Math.trunc(item.order ?? 0) : 0;

    if (order < 1 || order > 99) {
      throw new Error("Menu order must be between 1 and 99.");
    }

    return {
      ...settings,
      [item.key]: {
        enabled: item.enabled,
        label: normalizedText(item.label, 40, "Menu label"),
        order
      }
    };
  }, {});

  if (!Object.values(publicItems).some((item) => item.enabled)) {
    throw new Error("At least one public menu item must be enabled.");
  }

  return {
    public: publicItems,
    version: 1
  };
}

export async function getAdminSitePagesData(): Promise<AdminSitePagesData> {
  const setting = await readAppSetting(sitePagesSettingKey);
  const pages = mergePages(setting.value);

  return {
    pages,
    source: setting.source,
    stats: {
      enabled: pages.filter((page) => page.enabled).length,
      featured: pages.filter((page) => page.enabled && page.featured).length,
      total: pages.length,
      updatedAt: setting.updatedAt?.toISOString() ?? null
    }
  };
}

export async function getAdminSiteMenusData(): Promise<AdminSiteMenusData> {
  const setting = await readAppSetting(siteMenusSettingKey);
  const items = mergeMenuItems(setting.value);

  return {
    items,
    source: setting.source,
    stats: {
      enabled: items.filter((item) => item.enabled).length,
      total: items.length,
      updatedAt: setting.updatedAt?.toISOString() ?? null
    }
  };
}

export async function getAdminSiteThemeData(): Promise<AdminSiteThemeData> {
  const setting = await readAppSetting(siteThemeSettingKey);
  const tokens = mergeThemeTokens(setting.value);

  return {
    source: setting.source,
    stats: {
      changed: tokens.filter((token) => token.value !== token.defaultValue).length,
      total: tokens.length,
      updatedAt: setting.updatedAt?.toISOString() ?? null
    },
    tokens
  };
}

export async function getHomepagePageCards() {
  const { pages } = await getAdminSitePagesData();

  return pages
    .filter((page) => page.enabled && page.featured)
    .map((page) => ({
      body: page.description,
      href: page.href,
      icon: page.icon,
      title: page.title,
      tone: page.tone
    }));
}

export async function getPublicMenuNavigation(): Promise<NavigationItem[]> {
  const setting = await readAppSetting(siteMenusSettingKey);
  const items = mergeMenuItems(setting.value);

  return items
    .filter((item) => item.enabled)
    .map((item) => {
      const original = publicNavigation.find((navItem) => navItem.href === item.href);

      return {
        ...(original ?? publicNavigation[0]),
        href: item.href,
        icon: item.icon,
        label: item.label
      };
    });
}

export async function getSiteThemeStyle(): Promise<CSSProperties> {
  const setting = await readAppSetting(siteThemeSettingKey);
  const tokens = mergeThemeTokens(setting.value);

  return tokens.reduce<CSSProperties>((style, token) => {
    return {
      ...style,
      [token.css]: token.value
    };
  }, {});
}

export async function updateSitePages(input: SitePagesInput, actorId: string) {
  const value = normalizePagesInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: sitePagesSettingKey
    },
    update: {
      description: "Editable public page titles, descriptions, and homepage feature settings.",
      isSecret: false,
      value: value as Prisma.InputJsonValue
    },
    create: {
      description: "Editable public page titles, descriptions, and homepage feature settings.",
      isSecret: false,
      key: sitePagesSettingKey,
      value: value as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "site.pages.update",
    target: `app-setting:${sitePagesSettingKey}`,
    severity: "info",
    metadata: {
      enabled: Object.values(value.pages).filter((page) => page.enabled).length,
      featured: Object.values(value.pages).filter((page) => page.enabled && page.featured).length
    }
  });
}

export async function updateSiteMenus(input: SiteMenusInput, actorId: string) {
  const value = normalizeMenusInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: siteMenusSettingKey
    },
    update: {
      description: "Editable public header menu labels, visibility, and order.",
      isSecret: false,
      value: value as Prisma.InputJsonValue
    },
    create: {
      description: "Editable public header menu labels, visibility, and order.",
      isSecret: false,
      key: siteMenusSettingKey,
      value: value as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "site.menus.update",
    target: `app-setting:${siteMenusSettingKey}`,
    severity: "info",
    metadata: {
      enabled: Object.values(value.public).filter((item) => item.enabled).length
    }
  });
}

export async function updateSiteTheme(input: SiteThemeInput, actorId: string) {
  const value = normalizeThemeInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: siteThemeSettingKey
    },
    update: {
      description: "Editable Bouncecore CSS theme token values.",
      isSecret: false,
      value: value as Prisma.InputJsonValue
    },
    create: {
      description: "Editable Bouncecore CSS theme token values.",
      isSecret: false,
      key: siteThemeSettingKey,
      value: value as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "site.theme.update",
    target: `app-setting:${siteThemeSettingKey}`,
    severity: "warning",
    metadata: {
      changed: Object.entries(value.tokens).filter(([key, value]) => {
        const definition = editableThemeTokenDefinitions.find((token) => token.key === key);

        return definition?.defaultValue !== value;
      }).length
    }
  });
}
