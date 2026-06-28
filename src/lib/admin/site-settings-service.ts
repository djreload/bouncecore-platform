import { Prisma } from "@prisma/client";
import {
  legalPageForKey,
  mergeLegalPages,
  normalizeLegalPagesInput,
  type LegalPageInput,
  type LegalPageKey,
  type LegalPageSettings
} from "@/lib/admin/legal-pages-core";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { normalizeOptionalBrandingImageUrl } from "@/lib/media/media-service";

const siteSettingsKey = "site.general";

export type SiteSettingsInput = {
  announcementBody?: string;
  announcementCtaHref?: string;
  announcementCtaLabel?: string;
  announcementEnabled: boolean;
  announcementTitle?: string;
  faviconUrl?: string;
  footerSummary?: string;
  homepageBadge?: string;
  homepageIntro?: string;
  legalPages: LegalPageInput[];
  liveSocialLinks: Array<{
    enabled: boolean;
    label?: string;
    platform?: string;
    url?: string;
  }>;
  logoUrl?: string;
  siteName?: string;
  stagingTarget?: string;
  supportEmail?: string;
};

export type LiveSocialLink = {
  enabled: boolean;
  label: string;
  platform: string;
  url: string;
};

export type SiteSettings = {
  announcement: {
    body: string | null;
    ctaHref: string | null;
    ctaLabel: string | null;
    enabled: boolean;
    title: string | null;
  };
  branding: {
    faviconUrl: string | null;
    logoUrl: string | null;
  };
  footerSummary: string;
  homepageBadge: string;
  homepageIntro: string;
  liveSocialLinks: LiveSocialLink[];
  legalPages: LegalPageSettings[];
  siteName: string;
  stagingTarget: string | null;
  supportEmail: string | null;
};

export type AdminSiteSettingsData = {
  checks: Array<{
    detail: string;
    label: string;
    status: "ready" | "warning";
    value: string;
  }>;
  settings: SiteSettings;
  source: "default" | "database";
  updatedAt: string | null;
};

function defaultSiteSettings(): SiteSettings {
  return {
    announcement: {
      body: null,
      ctaHref: null,
      ctaLabel: null,
      enabled: false,
      title: null
    },
    branding: {
      faviconUrl: null,
      logoUrl: null
    },
    footerSummary: "Bouncecore is the platform shell for livestreams, chatrooms, merch, music, live support, and mobile APIs.",
    homepageBadge: "Bouncecore platform",
    homepageIntro:
      "A dark, premium platform for UK rave livestreams, chatrooms, DJ profiles, producer music, merch, live star support, and mobile apps.",
    legalPages: mergeLegalPages(null),
    liveSocialLinks: [],
    siteName: "Bouncecore",
    stagingTarget: null,
    supportEmail: null
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedText(value: string | undefined, maxLength: number) {
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
  const text = normalizedText(value, maxLength);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizedEmail(value: string | undefined) {
  const email = normalizedText(value, 160);

  if (!email) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Support email must be a valid email address.");
  }

  return email.toLowerCase();
}

function normalizedUrl(value: string | undefined, label: string) {
  const url = normalizedText(value, 300);

  if (!url) {
    return null;
  }

  if (url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${label} must be a relative path or http/https URL.`);
  }

  return url;
}

function normalizedExternalUrl(value: string | undefined, label: string) {
  const url = normalizedText(value, 300);

  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${label} must be a full http/https URL.`);
  }

  return url;
}

function safeBrandingImageUrl(value: unknown, label: string) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return normalizeOptionalBrandingImageUrl(value, label);
  } catch {
    return null;
  }
}

function normalizePlatform(value: string | undefined) {
  const platform = normalizedText(value, 40)?.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  return platform || "link";
}

function normalizeLiveSocialLinks(
  links: Array<{
    enabled: boolean;
    label?: string;
    platform?: string;
    url?: string;
  }>
) {
  return links
    .slice(0, 8)
    .map((link, index) => {
      const url = normalizedExternalUrl(link.url, `Social link ${index + 1}`);
      const label = normalizedText(link.label, 40);

      if (!url && !label) {
        return null;
      }

      if (!url || !label) {
        throw new Error(`Social link ${index + 1} needs both label and URL.`);
      }

      return {
        enabled: link.enabled,
        label,
        platform: normalizePlatform(link.platform || label),
        url
      };
    })
    .filter((link): link is LiveSocialLink => Boolean(link));
}

function mergeSiteSettings(value: unknown): SiteSettings {
  const settings = defaultSiteSettings();

  if (!isObject(value)) {
    return settings;
  }

  if (typeof value.siteName === "string" && value.siteName.trim()) {
    settings.siteName = value.siteName.trim().slice(0, 80);
  }

  if (typeof value.homepageBadge === "string" && value.homepageBadge.trim()) {
    settings.homepageBadge = value.homepageBadge.trim().slice(0, 80);
  }

  if (typeof value.homepageIntro === "string" && value.homepageIntro.trim()) {
    settings.homepageIntro = value.homepageIntro.trim().slice(0, 320);
  }

  if (typeof value.footerSummary === "string" && value.footerSummary.trim()) {
    settings.footerSummary = value.footerSummary.trim().slice(0, 240);
  }

  if (typeof value.supportEmail === "string" && value.supportEmail.trim()) {
    settings.supportEmail = value.supportEmail.trim().slice(0, 160).toLowerCase();
  }

  if (typeof value.stagingTarget === "string" && value.stagingTarget.trim()) {
    settings.stagingTarget = value.stagingTarget.trim().slice(0, 160);
  }

  if (isObject(value.announcement)) {
    settings.announcement.enabled =
      typeof value.announcement.enabled === "boolean" ? value.announcement.enabled : settings.announcement.enabled;

    if (typeof value.announcement.title === "string" && value.announcement.title.trim()) {
      settings.announcement.title = value.announcement.title.trim().slice(0, 120);
    }

    if (typeof value.announcement.body === "string" && value.announcement.body.trim()) {
      settings.announcement.body = value.announcement.body.trim().slice(0, 300);
    }

    if (typeof value.announcement.ctaLabel === "string" && value.announcement.ctaLabel.trim()) {
      settings.announcement.ctaLabel = value.announcement.ctaLabel.trim().slice(0, 60);
    }

    if (typeof value.announcement.ctaHref === "string" && value.announcement.ctaHref.trim()) {
      settings.announcement.ctaHref = value.announcement.ctaHref.trim().slice(0, 300);
    }
  }

  if (isObject(value.branding)) {
    settings.branding.logoUrl = safeBrandingImageUrl(value.branding.logoUrl, "Logo URL");
    settings.branding.faviconUrl = safeBrandingImageUrl(value.branding.faviconUrl, "Favicon URL");
  }

  if (Array.isArray(value.liveSocialLinks)) {
    settings.liveSocialLinks = value.liveSocialLinks
      .map((link) => {
        if (!isObject(link)) {
          return null;
        }

        const label = typeof link.label === "string" ? link.label.trim().slice(0, 40) : "";
        const platform = typeof link.platform === "string" ? normalizePlatform(link.platform) : normalizePlatform(label);
        const url = typeof link.url === "string" ? link.url.trim().slice(0, 300) : "";

        if (!label || !url) {
          return null;
        }

        return {
          enabled: typeof link.enabled === "boolean" ? link.enabled : true,
          label,
          platform,
          url
        };
      })
      .filter((link): link is LiveSocialLink => Boolean(link))
      .slice(0, 8);
  }

  if (Array.isArray(value.legalPages)) {
    settings.legalPages = mergeLegalPages(value.legalPages);
  }

  return settings;
}

function normalizeSiteSettingsInput(input: SiteSettingsInput): SiteSettings {
  const announcementTitle = normalizedText(input.announcementTitle, 120);
  const announcementBody = normalizedText(input.announcementBody, 300);
  const announcementCtaLabel = normalizedText(input.announcementCtaLabel, 60);
  const announcementCtaHref = normalizedUrl(input.announcementCtaHref, "Announcement link");

  if (input.announcementEnabled && !announcementTitle) {
    throw new Error("Announcement title is required when the announcement is enabled.");
  }

  if (announcementCtaHref && !announcementCtaLabel) {
    throw new Error("Announcement button text is required when a button link is set.");
  }

  return {
    announcement: {
      body: announcementBody,
      ctaHref: announcementCtaHref,
      ctaLabel: announcementCtaLabel,
      enabled: input.announcementEnabled,
      title: announcementTitle
    },
    branding: {
      faviconUrl: normalizeOptionalBrandingImageUrl(input.faviconUrl, "Favicon URL"),
      logoUrl: normalizeOptionalBrandingImageUrl(input.logoUrl, "Logo URL")
    },
    footerSummary: normalizedRequiredText(input.footerSummary, 240, "Footer summary"),
    homepageBadge: normalizedRequiredText(input.homepageBadge, 80, "Homepage badge"),
    homepageIntro: normalizedRequiredText(input.homepageIntro, 320, "Homepage intro"),
    legalPages: normalizeLegalPagesInput(input.legalPages),
    liveSocialLinks: normalizeLiveSocialLinks(input.liveSocialLinks),
    siteName: normalizedRequiredText(input.siteName, 80, "Site name"),
    stagingTarget: normalizedText(input.stagingTarget, 160),
    supportEmail: normalizedEmail(input.supportEmail)
  };
}

async function readSiteSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: siteSettingsKey
    }
  });

  return {
    settings: mergeSiteSettings(setting?.value),
    source: setting ? ("database" as const) : ("default" as const),
    updatedAt: setting?.updatedAt ?? null
  };
}

export async function getPublicSiteSettings() {
  const { settings } = await readSiteSettings();

  return settings;
}

export async function getPublicLegalPageData(key: LegalPageKey) {
  const { settings, updatedAt } = await readSiteSettings();

  return {
    page: legalPageForKey(settings.legalPages, key),
    siteSettings: settings,
    updatedAt: updatedAt?.toISOString() ?? null
  };
}

export async function getAdminSiteSettingsData(): Promise<AdminSiteSettingsData> {
  const { settings, source, updatedAt } = await readSiteSettings();

  return {
    checks: [
      {
        detail:
          source === "database"
            ? "The homepage is reading the saved site settings."
            : "The homepage is using built-in defaults until this page is saved.",
        label: "Config source",
        status: source === "database" ? "ready" : "warning",
        value: source
      },
      {
        detail: settings.announcement.enabled
          ? settings.announcement.title ?? "Homepage announcement is enabled."
          : "No homepage announcement is currently displayed.",
        label: "Homepage announcement",
        status: settings.announcement.enabled ? "warning" : "ready",
        value: settings.announcement.enabled ? "enabled" : "disabled"
      },
      {
        detail: settings.supportEmail
          ? `Public support email is ${settings.supportEmail}.`
          : "No public support email is currently configured.",
        label: "Support email",
        status: settings.supportEmail ? "ready" : "warning",
        value: settings.supportEmail ? "set" : "missing"
      },
      {
        detail: settings.liveSocialLinks.some((link) => link.enabled)
          ? `${settings.liveSocialLinks.filter((link) => link.enabled).length} live-page social links are enabled.`
          : "No live-page social links are enabled.",
        label: "Live social links",
        status: settings.liveSocialLinks.some((link) => link.enabled) ? "ready" : "warning",
        value: settings.liveSocialLinks.filter((link) => link.enabled).length.toString()
      },
      {
        detail:
          settings.branding.logoUrl || settings.branding.faviconUrl
            ? "Custom public logo or browser icon is configured."
            : "No custom public logo or browser icon is configured.",
        label: "Branding",
        status: settings.branding.logoUrl || settings.branding.faviconUrl ? "ready" : "warning",
        value: settings.branding.logoUrl || settings.branding.faviconUrl ? "set" : "missing"
      },
      {
        detail: settings.legalPages.some((page) => page.enabled)
          ? `${settings.legalPages.filter((page) => page.enabled).length} public legal pages are enabled.`
          : "No public legal pages are enabled.",
        label: "Legal pages",
        status: settings.legalPages.some((page) => page.enabled) ? "ready" : "warning",
        value: settings.legalPages.filter((page) => page.enabled).length.toString()
      }
    ],
    settings,
    source,
    updatedAt: updatedAt?.toISOString() ?? null
  };
}

export async function updateSiteSettings(input: SiteSettingsInput, actorId: string) {
  const settings = normalizeSiteSettingsInput(input);

  await prisma.appSetting.upsert({
    where: {
      key: siteSettingsKey
    },
    update: {
      description: "General public site copy, homepage announcement, and support details.",
      isSecret: false,
      value: settings as Prisma.InputJsonValue
    },
    create: {
      description: "General public site copy, homepage announcement, and support details.",
      isSecret: false,
      key: siteSettingsKey,
      value: settings as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "site.settings.update",
    target: `app-setting:${siteSettingsKey}`,
    severity: settings.announcement.enabled ? "warning" : "info",
    metadata: {
      announcementEnabled: settings.announcement.enabled,
      brandingFaviconSet: Boolean(settings.branding.faviconUrl),
      brandingLogoSet: Boolean(settings.branding.logoUrl),
      legalPages: settings.legalPages.filter((page) => page.enabled).map((page) => page.key),
      liveSocialLinks: settings.liveSocialLinks.filter((link) => link.enabled).length,
      siteName: settings.siteName,
      supportEmailSet: Boolean(settings.supportEmail)
    }
  });

  return settings;
}
