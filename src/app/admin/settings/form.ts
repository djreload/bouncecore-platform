import type { SiteSettingsInput } from "@/lib/admin/site-settings-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export function adminSettingsInput(formData: FormData): SiteSettingsInput {
  return {
    announcementBody: formString(formData, "announcementBody"),
    announcementCtaHref: formString(formData, "announcementCtaHref"),
    announcementCtaLabel: formString(formData, "announcementCtaLabel"),
    announcementEnabled: formBoolean(formData, "announcementEnabled"),
    announcementTitle: formString(formData, "announcementTitle"),
    footerSummary: formString(formData, "footerSummary"),
    homepageBadge: formString(formData, "homepageBadge"),
    homepageIntro: formString(formData, "homepageIntro"),
    siteName: formString(formData, "siteName"),
    stagingTarget: formString(formData, "stagingTarget"),
    supportEmail: formString(formData, "supportEmail")
  };
}
