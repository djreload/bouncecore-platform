import Image from "next/image";
import { Activity, Radio, Sparkles } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { icons } from "@/components/navigation/icons";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getHomepagePageCards } from "@/lib/admin/site-design-service";
import { getPublicSiteSettings } from "@/lib/admin/site-settings-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [siteSettings, modules] = await Promise.all([getPublicSiteSettings(), getHomepagePageCards()]);

  return (
    <PublicShell siteSettings={siteSettings}>
      <section className="relative isolate min-h-[78vh] overflow-hidden border-b border-bc-line">
        <Image
          alt="Neon DJ stage for Bouncecore livestreams"
          className="object-cover"
          fill
          priority
          src="/images/bouncecore-stage-hero.png"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bc-void via-bc-void/72 to-bc-void/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-bc-void via-transparent to-bc-void/15" />
        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-center px-4 py-16">
          <div className="max-w-3xl">
            <Badge tone="pink">{siteSettings.homepageBadge}</Badge>
            <h1 className="mt-5 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">{siteSettings.siteName}</h1>
            <p className="mt-5 max-w-2xl text-lg text-bc-muted sm:text-xl">{siteSettings.homepageIntro}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/live" size="lg">
                <Radio className="h-5 w-5" aria-hidden="true" />
                Watch live
              </ButtonLink>
              <ButtonLink href="/admin" variant="ghost" size="lg">
                <Activity className="h-5 w-5" aria-hidden="true" />
                Admin control room
              </ButtonLink>
            </div>
            {siteSettings.announcement.enabled && siteSettings.announcement.title ? (
              <div className="mt-7 max-w-2xl border-l-2 border-bc-acid pl-4">
                <Badge tone="acid">Announcement</Badge>
                <h2 className="mt-3 text-2xl font-black">{siteSettings.announcement.title}</h2>
                {siteSettings.announcement.body ? (
                  <p className="mt-2 text-sm text-bc-muted">{siteSettings.announcement.body}</p>
                ) : null}
                {siteSettings.announcement.ctaHref && siteSettings.announcement.ctaLabel ? (
                  <div className="mt-4">
                    <ButtonLink href={siteSettings.announcement.ctaHref} variant="ghost" size="sm">
                      {siteSettings.announcement.ctaLabel}
                    </ButtonLink>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="bg-bc-ink py-12">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = icons[module.icon];
            return (
              <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={module.title}>
                <Badge tone={module.tone}>{module.title}</Badge>
                <Icon className="mt-5 h-8 w-8 text-white" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">{module.title}</h2>
                <p className="mt-2 text-sm text-bc-muted">{module.body}</p>
                <div className="mt-4">
                  <ButtonLink href={module.href} variant="ghost" size="sm">
                    Open {module.title}
                  </ButtonLink>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bc-grid border-t border-bc-line bg-bc-void py-12">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-[1fr_380px]">
          <div>
            <Badge tone="acid">Foundation modules</Badge>
            <h2 className="mt-4 text-3xl font-black">One account, live chat, stars, music, merch, and streamer tools.</h2>
            <p className="mt-3 max-w-3xl text-bc-muted">
              Bouncecore keeps public pages, account dashboards, role-specific workspaces, payments, uploads, and admin tools
              inside one consistent experience.
            </p>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Sparkles className="h-8 w-8 text-bc-acid" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Site controls</h3>
            <p className="mt-2 text-sm text-bc-muted">
              Admin-managed settings now control homepage copy, live-page links, announcements, public policy pages, theme tokens,
              menus, and mobile app behaviour.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
