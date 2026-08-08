import type { Metadata } from "next";
import { CircleDot, Gamepad2, Gift, Swords, UsersRound } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Games | Bouncecore"
};

const availableGames = [
  {
    description: "Challenge another chatter to a turn-based battle from the live room.",
    href: "/chat",
    icon: Swords,
    linkLabel: "Open live chat",
    status: "Live",
    title: "Rave Wars"
  },
  {
    description: "Use stars to spin the configured prize wheel and claim winning rewards.",
    href: "/rewards",
    icon: Gift,
    linkLabel: "Open rewards",
    status: "Live",
    title: "Rewards Wheel"
  }
] as const;

export default function GamesPage() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-4 border-b border-bc-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-bc-electric">
              <Gamepad2 className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-[0.08em]">Games room</span>
            </div>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Play on Bouncecore</h1>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">Choose a game that works across desktop, mobile browsers, and the Bouncecore app.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-bc-muted">
            <UsersRound className="h-4 w-4 text-bc-acid" aria-hidden="true" />
            Chat-connected games
          </div>
        </header>

        <section className="grid gap-3 py-6 md:grid-cols-2" aria-label="Available games">
          {availableGames.map((game) => {
            const Icon = game.icon;

            return (
              <article className="flex min-h-48 flex-col rounded-md border border-bc-line bg-bc-panel p-5 shadow-lg shadow-black/15" key={game.title}>
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <Badge tone="acid">{game.status}</Badge>
                </div>
                <h2 className="mt-4 text-xl font-black">{game.title}</h2>
                <p className="mt-2 text-sm leading-6 text-bc-muted">{game.description}</p>
                <ButtonLink className="mt-auto w-fit" href={game.href} size="sm">
                  <Gamepad2 className="h-4 w-4" aria-hidden="true" />
                  {game.linkLabel}
                </ButtonLink>
              </article>
            );
          })}
        </section>

        <section className="flex flex-col gap-4 border-y border-bc-line py-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Upcoming games">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-pink/40 bg-bc-pink/10 text-bc-pink">
              <CircleDot className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black">8 Ball Pool</h2>
                <Badge tone="muted">Planned</Badge>
              </div>
              <p className="mt-1 text-sm text-bc-muted">The next game will join this same room when it is ready for mobile play.</p>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
