"use client";

import { useActionState } from "react";
import { Globe2, Megaphone, Save, Settings, Share2 } from "lucide-react";
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
  const socialLinkRows = Array.from({ length: 8 }, (_value, index) => {
    const link = data.settings.liveSocialLinks[index];

    return {
      enabled: link?.enabled ?? false,
      label: link?.label ?? "",
      platform: link?.platform ?? "",
      url: link?.url ?? ""
    };
  });

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
