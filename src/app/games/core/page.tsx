import type { Metadata } from "next";
import {
  Activity,
  Crosshair,
  Flag,
  Gamepad2,
  Keyboard,
  MousePointer2,
  Play,
  ShieldCheck,
  Swords,
  Trophy,
  Users
} from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getCoreFpsHubData } from "@/lib/games/core-fps-score-service";
import { getPublicCoreFpsSettings } from "@/lib/games/core-fps-settings-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Play Core FPS with Bouncecore members and follow verified scores.",
  robots: {
    follow: false,
    index: false
  },
  title: "Core FPS"
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function stat(value: number) {
  return value.toLocaleString("en-GB");
}

export default async function CoreFpsHubPage() {
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
              The shared game service is currently disabled while its isolated runtime and verified scoring are being configured.
            </p>
            <ButtonLink className="mt-6" href="/live" variant="ghost">
              Back to live
            </ButtonLink>
          </section>
        </main>
      </PublicShell>
    );
  }

  const user = await requireSignedInUser();
  const data = await getCoreFpsHubData(user.id);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="border-b border-bc-line pb-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="pink">Shared arena</Badge>
                <Badge tone={data.onlinePlayers ? "acid" : "cyan"}>
                  {data.onlinePlayers ? `${data.onlinePlayers} playing` : "Arena ready"}
                </Badge>
              </div>
              <h1 className="mt-4 text-4xl font-black">Core FPS</h1>
              <p className="mt-3 text-bc-muted">
                Join the same fast 3D arena as other Bouncecore members. Your launch is account-linked and scores are accepted only from the game service.
              </p>
            </div>
            <ButtonLink href="/games/core/play" prefetch={false} size="lg">
              <Play className="h-5 w-5" aria-hidden="true" />
              Start game
            </ButtonLink>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-md border border-bc-line bg-bc-panel p-4">
              <p className="text-xs font-semibold uppercase text-bc-muted">Your score</p>
              <p className="mt-2 text-2xl font-black text-bc-electric">{stat(data.personal.score)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-panel p-4">
              <p className="text-xs font-semibold uppercase text-bc-muted">Frags</p>
              <p className="mt-2 text-2xl font-black">{stat(data.personal.frags)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-panel p-4">
              <p className="text-xs font-semibold uppercase text-bc-muted">Damage</p>
              <p className="mt-2 text-2xl font-black">{stat(data.personal.damage)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-panel p-4">
              <p className="text-xs font-semibold uppercase text-bc-muted">Sessions</p>
              <p className="mt-2 text-2xl font-black">{stat(data.personal.sessions)}</p>
            </article>
          </div>
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <section className="rounded-md border border-bc-line bg-bc-panel">
              <div className="flex items-center justify-between gap-4 border-b border-bc-line p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                    <h2 className="text-xl font-black">All-time leaderboard</h2>
                  </div>
                  <p className="mt-1 text-sm text-bc-muted">Only server-verified arena statistics are ranked.</p>
                </div>
                <Badge tone="cyan">Top 20</Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead className="text-xs uppercase text-bc-muted">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3 text-right">Frags</th>
                      <th className="px-4 py-3 text-right">Deaths</th>
                      <th className="px-4 py-3 text-right">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((row) => (
                      <tr className="border-t border-bc-line" key={row.userId}>
                        <td className="px-4 py-3 font-black text-bc-acid">#{row.rank}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">{row.displayName}</span>
                          <span className="ml-2 text-xs text-bc-muted">{row.sessions} sessions</span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-bc-electric">{stat(row.score)}</td>
                        <td className="px-4 py-3 text-right">{stat(row.frags)}</td>
                        <td className="px-4 py-3 text-right">{stat(row.deaths)}</td>
                        <td className="px-4 py-3 text-right">{stat(row.flags)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!data.leaderboard.length ? (
                <div className="border-t border-bc-line p-6 text-center">
                  <Crosshair className="mx-auto h-8 w-8 text-bc-electric" aria-hidden="true" />
                  <h3 className="mt-3 font-black">No verified scores yet</h3>
                  <p className="mt-1 text-sm text-bc-muted">The leaderboard starts when the first arena statistics arrive.</p>
                </div>
              ) : null}
            </section>

            <section className="rounded-md border border-bc-line bg-bc-panel">
              <div className="border-b border-bc-line p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-bc-pink" aria-hidden="true" />
                  <h2 className="text-xl font-black">Your recent sessions</h2>
                </div>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {data.recentSessions.map((session) => (
                  <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={session.id}>
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={session.status === "active" ? "acid" : "cyan"}>{session.status}</Badge>
                      <span className="text-xs text-bc-muted">{formatDate(session.createdAt)}</span>
                    </div>
                    <p className="mt-3 text-xl font-black">{stat(session.score)} points</p>
                    <p className="mt-2 text-sm text-bc-muted">
                      {session.frags} frags · {session.deaths} deaths · {stat(session.damage)} damage
                    </p>
                    <p className="mt-2 truncate text-xs text-bc-muted">
                      {[session.modeName, session.mapName].filter(Boolean).join(" · ") || "Arena details pending"}
                    </p>
                  </article>
                ))}
                {!data.recentSessions.length ? (
                  <div className="rounded-md border border-bc-line bg-bc-ink p-5 md:col-span-2">
                    <p className="font-semibold">You have not entered the arena yet.</p>
                    <p className="mt-1 text-sm text-bc-muted">Start the game to create your first account-linked session.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-md border border-bc-line bg-bc-panel p-5">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                <h2 className="text-xl font-black">Controls</h2>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-bc-line pb-3">
                  <dt className="text-bc-muted">Move</dt>
                  <dd className="font-semibold">W A S D</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-bc-line pb-3">
                  <dt className="text-bc-muted">Aim</dt>
                  <dd className="font-semibold">Mouse</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-bc-line pb-3">
                  <dt className="text-bc-muted">Fire</dt>
                  <dd className="font-semibold">Left click</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-bc-line pb-3">
                  <dt className="text-bc-muted">Jump</dt>
                  <dd className="font-semibold">Space</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-bc-line pb-3">
                  <dt className="text-bc-muted">Change weapon</dt>
                  <dd className="font-semibold">Mouse wheel / 1-7</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-bc-muted">Chat / menu</dt>
                  <dd className="font-semibold">T / Esc</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-bc-line bg-bc-panel p-5">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-bc-pink" aria-hidden="true" />
                <h2 className="text-xl font-black">How scoring works</h2>
              </div>
              <p className="mt-3 text-sm text-bc-muted">
                Eliminate opponents and play the objective. A frag earns 100 points, a captured flag earns 300, a death costs 25, and a team kill costs 100.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-md border border-bc-line bg-bc-ink p-3">
                  <Crosshair className="mb-2 h-4 w-4 text-bc-electric" aria-hidden="true" />
                  Frags
                </span>
                <span className="rounded-md border border-bc-line bg-bc-ink p-3">
                  <Flag className="mb-2 h-4 w-4 text-bc-acid" aria-hidden="true" />
                  Objectives
                </span>
              </div>
            </section>

            <section className="rounded-md border border-bc-line bg-bc-panel p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                <h2 className="text-xl font-black">Fair play</h2>
              </div>
              <p className="mt-3 text-sm text-bc-muted">
                Browser-submitted scores are ignored. The isolated game service reports counters against the signed session created when you press Start game.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-bc-muted">
                <Users className="h-4 w-4" aria-hidden="true" />
                Signed in as {user.displayName}
              </div>
            </section>

            <section className="rounded-md border border-bc-line bg-bc-panel p-5">
              <MousePointer2 className="h-5 w-5 text-bc-electric" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-black">Before you start</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Click inside the game to capture the pointer. Press Esc to release it. Headphones are recommended while a livestream is playing.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
