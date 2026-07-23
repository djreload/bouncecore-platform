import type { Metadata } from "next";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { CoreFpsGameFrame } from "@/app/games/core/play/core-fps-game-frame";
import { CoreFpsPresenceTracker } from "@/app/games/core/play/core-fps-presence-tracker";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { createCoreFpsLaunch, getPublicCoreFpsSettings } from "@/lib/games/core-fps-settings-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Play the isolated Core FPS game with your Bouncecore account.",
  robots: {
    follow: false,
    index: false
  },
  title: "Play Core FPS"
};

export default async function CoreFpsPlayPage() {
  const settings = await getPublicCoreFpsSettings();

  if (!settings.enabled) {
    return (
      <PublicShell>
        <main className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-5xl items-center px-4 py-8">
          <section className="w-full rounded-md border border-bc-line bg-bc-panel p-6 md:p-8">
            <Badge tone="amber">Offline</Badge>
            <Gamepad2 className="mt-6 h-12 w-12 text-bc-electric" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-black">Core FPS</h1>
            <p className="mt-3 max-w-2xl text-bc-muted">The game service is currently disabled.</p>
            <ButtonLink className="mt-6" href="/games/core" variant="ghost">
              Game information
            </ButtonLink>
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
            <ButtonLink href="/games/core" size="sm" variant="ghost">
              Game hub
            </ButtonLink>
          </div>
        </div>

        {launch ? (
          <div className="relative min-h-0 flex-1 bg-black">
            <CoreFpsPresenceTracker sessionId={launch.sessionId} />
            <CoreFpsGameFrame launchUrl={launch.launchUrl} />
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

        <div className="hidden items-center gap-4 border-t border-bc-line bg-bc-ink px-4 py-2 text-xs text-bc-muted lg:flex">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-bc-acid" aria-hidden="true" />
            Shared arena connected. Click the game once to capture keyboard and mouse; press Esc to release them.
          </span>
        </div>
      </main>
    </PublicShell>
  );
}
