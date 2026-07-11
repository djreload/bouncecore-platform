import type { SiteSettingsInput } from "@/lib/admin/site-settings-service";
import { legalPageKeys } from "@/lib/admin/legal-pages-core";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export function adminSettingsInput(formData: FormData): SiteSettingsInput {
  const liveSocialLinks = Array.from({ length: 8 }, (_value, index) => ({
    enabled: formBoolean(formData, `liveSocialLinks.${index}.enabled`),
    label: formString(formData, `liveSocialLinks.${index}.label`),
    platform: formString(formData, `liveSocialLinks.${index}.platform`),
    url: formString(formData, `liveSocialLinks.${index}.url`)
  }));
  const legalPages = legalPageKeys.map((key) => ({
    body: formString(formData, `legalPages.${key}.body`),
    enabled: formBoolean(formData, `legalPages.${key}.enabled`),
    key,
    title: formString(formData, `legalPages.${key}.title`)
  }));

  return {
    announcementBody: formString(formData, "announcementBody"),
    announcementCtaHref: formString(formData, "announcementCtaHref"),
    announcementCtaLabel: formString(formData, "announcementCtaLabel"),
    announcementEnabled: formBoolean(formData, "announcementEnabled"),
    announcementTitle: formString(formData, "announcementTitle"),
    faviconUrl: formString(formData, "faviconUrl"),
    footerSummary: formString(formData, "footerSummary"),
    homepageBadge: formString(formData, "homepageBadge"),
    homepageIntro: formString(formData, "homepageIntro"),
    legalPages,
    liveSocialLinks,
    logoUrl: formString(formData, "logoUrl"),
    openGraphImageUrl: formString(formData, "openGraphImageUrl"),
    siteName: formString(formData, "siteName"),
    stagingTarget: formString(formData, "stagingTarget"),
    supportEmail: formString(formData, "supportEmail")
  };
}
