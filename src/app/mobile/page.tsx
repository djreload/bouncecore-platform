import { Bell, Download, Radio, ShieldCheck, Smartphone } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPublicMobileConfig } from "@/lib/admin/mobile-service";

export const dynamic = "force-dynamic";

function appVersionLabel(versionName: string | null, versionCode: number | null) {
  if (versionName && versionCode) {
    return `${versionName} / build ${versionCode}`;
  }

  if (versionName) {
    return versionName;
  }

  if (versionCode) {
    return `build ${versionCode}`;
  }

  return "Latest build";
}

export default async function MobileAppPage() {
  const config = await getPublicMobileConfig();
  const updateUrl = config.version.updateUrl;
  const latestVersion = appVersionLabel(config.version.latestVersionName, config.version.latestVersionCode);

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="grid gap-6 rounded-md border border-bc-line bg-bc-panel p-6 lg:grid-cols-[1fr_360px]">
          <div>
            <Badge tone={updateUrl ? "acid" : "amber"}>{updateUrl ? "Android APK" : "APK pending"}</Badge>
            <h1 className="mt-4 text-4xl font-black">Bouncecore Android app</h1>
            <p className="mt-3 max-w-3xl text-bc-muted">
              Install the Android app for the site-backed Bouncecore experience. APK downloads are controlled from Admin -&gt; Mobile.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {updateUrl ? (
                <a
                  className="bc-button bc-button-primary bc-focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-bc-electric px-5 py-2 text-base font-semibold text-bc-void transition"
                  href={updateUrl}
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Download APK
                </a>
              ) : (
                <ButtonLink href="/support" variant="primary">
                  Contact support
                </ButtonLink>
              )}
              <ButtonLink href="/privacy" variant="ghost">
                Privacy Policy
              </ButtonLink>
            </div>
          </div>
          <aside className="rounded-md border border-bc-line bg-bc-ink p-5">
            <Smartphone className="h-8 w-8 text-bc-electric" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Current app release</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-md border border-bc-line bg-bc-panel p-3">
                <p className="text-bc-muted">Version</p>
                <p className="mt-1 font-black">{latestVersion}</p>
              </div>
              <div className="rounded-md border border-bc-line bg-bc-panel p-3">
                <p className="text-bc-muted">Minimum supported build</p>
                <p className="mt-1 font-black">{config.version.minimumSupportedVersionCode}</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Radio className="h-6 w-6 text-bc-electric" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Live</h2>
            <p className="mt-2 text-sm text-bc-muted">Open the stream, live chat, stars, and alerts from the app shell.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Bell className="h-6 w-6 text-bc-pink" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Notifications</h2>
            <p className="mt-2 text-sm text-bc-muted">Logged-in users can receive supported account and chat push notifications.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <ShieldCheck className="h-6 w-6 text-bc-acid" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Privacy</h2>
            <p className="mt-2 text-sm text-bc-muted">Mobile ad consent and notification choices stay controllable from account settings.</p>
          </article>
        </section>
      </main>
    </PublicShell>
  );
}
