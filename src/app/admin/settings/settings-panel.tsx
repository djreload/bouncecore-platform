"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useState } from "react";
import { FileText, Globe2, Image as ImageIcon, Megaphone, Save, Settings, Share2, UploadCloud } from "lucide-react";
import { adminSettingsAction } from "@/app/admin/settings/actions";
import { initialAdminSettingsActionState, type AdminSettingsActionState } from "@/app/admin/settings/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminSiteSettingsData } from "@/lib/admin/site-settings-service";

type AdminSettingsPanelProps = {
  data: AdminSiteSettingsData;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not saved";
}

function checkTone(status: string) {
  return status === "ready" ? ("acid" as const) : ("amber" as const);
}

export function AdminSettingsPanel({ data }: AdminSettingsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminSettingsActionState, FormData>(
    adminSettingsAction,
    initialAdminSettingsActionState
  );
  const [logoUrl, setLogoUrl] = useState(data.settings.branding.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(data.settings.branding.faviconUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [brandUploadError, setBrandUploadError] = useState("");
  const socialLinkRows = Array.from({ length: 8 }, (_value, index) => {
    const link = data.settings.liveSocialLinks[index];

    return {
      enabled: link?.enabled ?? false,
      label: link?.label ?? "",
      platform: link?.platform ?? "",
      url: link?.url ?? ""
    };
  });

  async function uploadBrandingAsset(
    kind: "branding-logo" | "branding-favicon",
    file: File,
    onUrl: (url: string) => void,
    onUploading: (uploading: boolean) => void
  ) {
    const uploadData = new FormData();
    uploadData.set("kind", kind);
    uploadData.set("file", file);
    setBrandUploadError("");
    onUploading(true);

    try {
      const response = await fetch("/api/admin/uploads", {
        body: uploadData,
        method: "POST"
      });
      const result = (await response.json().catch(() => ({}))) as { error?: unknown; url?: unknown };

      if (!response.ok || typeof result.url !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : "Upload failed.");
      }

      onUrl(result.url);
    } catch (error) {
      setBrandUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      onUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.source === "database" ? "acid" : "amber"}>Source</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.source}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatDate(data.updatedAt)}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Site name</Badge>
          <p className="mt-4 text-3xl font-black">{data.settings.siteName}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.settings.homepageBadge}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.settings.announcement.enabled ? "amber" : "acid"}>Announcement</Badge>
          <p className="mt-4 text-3xl font-black">{data.settings.announcement.enabled ? "On" : "Off"}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.settings.announcement.title ?? "No announcement displayed."}</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">General settings</Badge>
            <h3 className="mt-4 text-2xl font-black">Public site copy</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              These settings feed the public homepage and keep basic platform copy editable without a deployment.
            </p>
          </div>
          <Settings className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form action={formAction} className="mt-5 grid gap-5">
          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                  <h4 className="font-black">Branding</h4>
                </div>
                <p className="mt-2 text-sm text-bc-muted">
                  Upload a public logo and favicon. Files are saved under /uploads/branding-images and validated before the
                  settings can be saved.
                </p>
              </div>
              <Badge tone={logoUrl || faviconUrl ? "acid" : "amber"}>{logoUrl || faviconUrl ? "Configured" : "Default"}</Badge>
            </div>

            {brandUploadError ? (
              <div className="mt-4 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
                {brandUploadError}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-bc-line bg-bc-panel p-3">
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="logo-url">
                  Public logo URL
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  disabled={pending || logoUploading}
                  id="logo-url"
                  name="logoUrl"
                  onChange={(event) => setLogoUrl(event.currentTarget.value)}
                  placeholder="/uploads/branding-images/logo.png"
                  value={logoUrl}
                />
                <p className="mt-2 text-xs text-bc-muted">
                  Used in the site header. Leave blank to use the default broadcast icon.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-md border border-bc-line bg-bc-ink">
                    {logoUrl ? (
                      <img className="max-h-11 max-w-11 object-contain" src={logoUrl} alt="" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-bc-muted" aria-hidden="true" />
                    )}
                  </span>
                  <label className="bc-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-semibold text-white hover:border-bc-electric/60">
                    <UploadCloud className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                    {logoUploading ? "Uploading..." : "Upload logo"}
                    <input
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      className="sr-only"
                      disabled={pending || logoUploading}
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const file = input.files?.[0];

                        if (!file) {
                          return;
                        }

                        await uploadBrandingAsset("branding-logo", file, setLogoUrl, setLogoUploading);
                        input.value = "";
                      }}
                      type="file"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-md border border-bc-line bg-bc-panel p-3">
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="favicon-url">
                  Favicon URL
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  disabled={pending || faviconUploading}
                  id="favicon-url"
                  name="faviconUrl"
                  onChange={(event) => setFaviconUrl(event.currentTarget.value)}
                  placeholder="/uploads/branding-images/favicon.png"
                  value={faviconUrl}
                />
                <p className="mt-2 text-xs text-bc-muted">
                  Used as the browser tab icon. Use a square PNG, WebP, GIF, JPG, or AVIF image.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-md border border-bc-line bg-bc-ink">
                    {faviconUrl ? (
                      <img className="max-h-9 max-w-9 object-contain" src={faviconUrl} alt="" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-bc-muted" aria-hidden="true" />
                    )}
                  </span>
                  <label className="bc-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-semibold text-white hover:border-bc-electric/60">
                    <UploadCloud className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                    {faviconUploading ? "Uploading..." : "Upload favicon"}
                    <input
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      className="sr-only"
                      disabled={pending || faviconUploading}
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const file = input.files?.[0];

                        if (!file) {
                          return;
                        }

                        await uploadBrandingAsset("branding-favicon", file, setFaviconUrl, setFaviconUploading);
                        input.value = "";
                      }}
                      type="file"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="site-name">
                Site name
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.siteName}
                disabled={pending}
                id="site-name"
                name="siteName"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="homepage-badge">
                Homepage badge
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.homepageBadge}
                disabled={pending}
                id="homepage-badge"
                name="homepageBadge"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="homepage-intro">
              Homepage intro
            </label>
            <textarea
              className="mt-2 min-h-28 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={data.settings.homepageIntro}
              disabled={pending}
              id="homepage-intro"
              name="homepageIntro"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-email">
                Support email
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.supportEmail ?? ""}
                disabled={pending}
                id="support-email"
                name="supportEmail"
                type="email"
              />
              <p className="mt-2 text-xs text-bc-muted">
                Leave blank to use PUBLIC_SUPPORT_EMAIL, SUPPORT_EMAIL, or MAIL_REPLY_TO when configured.
              </p>
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="staging-target">
                Staging target
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.stagingTarget ?? ""}
                disabled={pending}
                id="staging-target"
                name="stagingTarget"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="footer-summary">
              Footer summary
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={data.settings.footerSummary}
              disabled={pending}
              id="footer-summary"
              name="footerSummary"
            />
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                  <h4 className="font-black">Live page social links</h4>
                </div>
                <p className="mt-2 text-sm text-bc-muted">
                  These links appear directly below the live video player for viewers.
                </p>
              </div>
              <Badge tone="cyan">{data.settings.liveSocialLinks.filter((link) => link.enabled).length} enabled</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {socialLinkRows.map((link, index) => (
                <div className="grid gap-3 rounded-md border border-bc-line bg-bc-panel p-3 lg:grid-cols-[96px_1fr_150px_2fr]" key={index}>
                  <label className="flex items-center gap-2 text-sm text-bc-muted">
                    <input
                      defaultChecked={link.enabled}
                      disabled={pending}
                      name={`liveSocialLinks.${index}.enabled`}
                      type="checkbox"
                    />
                    Enabled
                  </label>
                  <div>
                    <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`social-label-${index}`}>
                      Label
                    </label>
                    <input
                      className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={link.label}
                      disabled={pending}
                      id={`social-label-${index}`}
                      name={`liveSocialLinks.${index}.label`}
                      placeholder="Instagram"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`social-platform-${index}`}>
                      Platform
                    </label>
                    <input
                      className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={link.platform}
                      disabled={pending}
                      id={`social-platform-${index}`}
                      name={`liveSocialLinks.${index}.platform`}
                      placeholder="instagram"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`social-url-${index}`}>
                      URL
                    </label>
                    <input
                      className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={link.url}
                      disabled={pending}
                      id={`social-url-${index}`}
                      name={`liveSocialLinks.${index}.url`}
                      placeholder="https://..."
                      type="url"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                  <h4 className="font-black">Public legal pages</h4>
                </div>
                <p className="mt-2 text-sm text-bc-muted">
                  Plain-text policy pages rendered safely on the public site and linked in the footer.
                </p>
              </div>
              <Badge tone="acid">{data.settings.legalPages.filter((page) => page.enabled).length} enabled</Badge>
            </div>
            <div className="mt-4 grid gap-4">
              {data.settings.legalPages.map((page) => (
                <article className="rounded-md border border-bc-line bg-bc-panel p-4" key={page.key}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Badge tone="cyan">{page.href}</Badge>
                      <h5 className="mt-3 font-black">{page.title}</h5>
                    </div>
                    <label className="flex items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-bc-muted">
                      <input
                        defaultChecked={page.enabled}
                        disabled={pending}
                        name={`legalPages.${page.key}.enabled`}
                        type="checkbox"
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`legal-title-${page.key}`}>
                        Title
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        defaultValue={page.title}
                        disabled={pending}
                        id={`legal-title-${page.key}`}
                        name={`legalPages.${page.key}.title`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`legal-body-${page.key}`}>
                        Body
                      </label>
                      <textarea
                        className="mt-2 min-h-52 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        defaultValue={page.body}
                        disabled={pending}
                        id={`legal-body-${page.key}`}
                        name={`legalPages.${page.key}.body`}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-bc-amber" aria-hidden="true" />
              <h4 className="font-black">Homepage announcement</h4>
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
              <input
                defaultChecked={data.settings.announcement.enabled}
                disabled={pending}
                name="announcementEnabled"
                type="checkbox"
              />
              Show announcement on homepage
            </label>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="announcement-title">
                  Title
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.settings.announcement.title ?? ""}
                  disabled={pending}
                  id="announcement-title"
                  name="announcementTitle"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="announcement-cta-label">
                  Button text
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.settings.announcement.ctaLabel ?? ""}
                  disabled={pending}
                  id="announcement-cta-label"
                  name="announcementCtaLabel"
                />
              </div>
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor="announcement-body">
              Body
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
              defaultValue={data.settings.announcement.body ?? ""}
              disabled={pending}
              id="announcement-body"
              name="announcementBody"
            />
            <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor="announcement-cta-href">
              Button link
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
              defaultValue={data.settings.announcement.ctaHref ?? ""}
              disabled={pending}
              id="announcement-cta-href"
              name="announcementCtaHref"
            />
          </div>

          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save general settings
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xl font-black">Readiness</h3>
          <Globe2 className="h-5 w-5 text-bc-electric" aria-hidden="true" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.checks.map((check) => (
            <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={check.label}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{check.label}</p>
                <Badge tone={checkTone(check.status)}>{check.value}</Badge>
              </div>
              <p className="mt-2 text-sm text-bc-muted">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
