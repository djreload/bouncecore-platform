import type { Metadata } from "next";
import { ExternalLink, Gamepad2, Maximize2, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { createCoreFpsLaunch, getPublicCoreFpsSettings } from "@/lib/games/core-fps-settings-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Launch the isolated Core FPS web game with your Bouncecore account.",
  robots: {
    follow: false,
    index: false
  },
  title: "Core FPS"
};

export default async function CoreFpsPage() {
  const settings = await getPublicCoreFpsSettings();

  if (!settings.enabled) {
    return (
      <PublicShell>
        <main className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-5xl items-center px-4 py-8">
          <section className="w-full rounded-md border border-bc-line bg-bc-panel p-6 md:p-8">
            <Badge tone="amber">Offline</Badge>
            <Gamepad2 className="mt-6 h-12 w-12 text-bc-electric" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-black">Core FPS</h1>
            <p className="mt-3 max-w-2xl text-bc-muted">
              The game service is currently disabled while its isolated runtime is being configured.
            </p>
            <div className="mt-6">
              <ButtonLink href="/live" variant="ghost">
                Back to live
              </ButtonLink>
            </div>
          </section>
        </main>
      </PublicShell>
    );
  }

  const user = await requireSignedInUser();
  let launch: Awaited<ReturnType<typeof createCoreFpsLaunch>> | null = null;
  let launchError: string | null = null;

  try {
    launch = await createCoreFpsLaunch(user);
  } catch (error) {
    launchError = error instanceof Error ? error.message : "Core FPS could not start.";
  }

  return (
    <PublicShell hideFooterOnMobile>
      <main className="flex min-h-[calc(100dvh-65px)] flex-col bg-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line bg-bc-ink px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric">
              <Gamepad2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-black">Core FPS</h1>
                <Badge tone="cyan">Isolated game</Badge>
              </div>
              <p className="truncate text-xs text-bc-muted">Signed in as {user.displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {launch ? (
              <a
                className="bc-button bc-button-primary bc-focus-ring inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-bc-electric px-3 text-xs font-semibold text-bc-void"
                href={launch.launchUrl}
                rel="noreferrer"
                target="_blank"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                Fullscreen
              </a>
            ) : null}
            <ButtonLink href="/live" size="sm" variant="ghost">
              Back to live
            </ButtonLink>
          </div>
        </div>

        {launch ? (
          <div className="relative min-h-0 flex-1 bg-black">
            <iframe
              allow="autoplay; clipboard-write; fullscreen; gamepad"
              className="absolute inset-0 h-full w-full border-0 bg-black"
              referrerPolicy="no-referrer"
              sandbox="allow-downloads allow-fullscreen allow-pointer-lock allow-same-origin allow-scripts"
              src={launch.launchUrl}
              title="Core FPS game"
            />
          </div>
        ) : (
          <section className="m-auto w-[min(680px,calc(100%-2rem))] rounded-md border border-bc-pink/35 bg-bc-panel p-6">
            <Badge tone="pink">Launch blocked</Badge>
            <h2 className="mt-4 text-2xl font-black">The game service is not ready</h2>
            <p className="mt-3 text-bc-muted">{launchError}</p>
            <div className="mt-5 flex items-center gap-2 text-sm text-bc-muted">
              <ShieldCheck className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              Bouncecore did not expose your site session to the game origin.
            </div>
          </section>
        )}

        <div className="hidden items-center justify-between gap-4 border-t border-bc-line bg-bc-ink px-4 py-2 text-xs text-bc-muted lg:flex">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-bc-acid" aria-hidden="true" />
            Separate origin, signed access, and no Bouncecore cookies shared
          </span>
          {launch ? (
            <a className="bc-focus-ring inline-flex items-center gap-1 rounded-sm hover:text-white" href={launch.publicUrl} rel="noreferrer" target="_blank">
              Open game origin
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </main>
    </PublicShell>
  );
}
