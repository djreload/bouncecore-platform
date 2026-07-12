"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RaveWarChallengeSummary } from "@/lib/rave-wars/rave-war-types";
import { cn } from "@/lib/utils";

type ChallengePayload = {
  challenges?: RaveWarChallengeSummary[];
  error?: string;
};

type RaveWarChallengeLauncherProps = {
  onNavigate?: () => void;
  placement?: "desktop" | "mobile-menu";
};

const pollMs = 2500;

function challengeLabel(challenge: RaveWarChallengeSummary) {
  return `${challenge.challengerDisplayName} vs ${challenge.targetDisplayName}`;
}

export function RaveWarChallengeLauncher({ onNavigate, placement = "desktop" }: RaveWarChallengeLauncherProps) {
  const [challenges, setChallenges] = useState<RaveWarChallengeSummary[]>([]);
  const [busyWarId, setBusyWarId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const visibleChallenges = challenges.filter((challenge) => challenge.status === "active" || !dismissedIds.has(challenge.id));
  const activeCount = visibleChallenges.filter((challenge) => challenge.status === "active").length;

  const refreshChallenges = useCallback(async () => {
    if (document.visibilityState === "hidden") {
      return;
    }

    try {
      const response = await fetch("/api/rave-wars/challenges", {
        cache: "no-store"
      });
      const payload = (await response.json()) as ChallengePayload;

      if (response.ok) {
        setChallenges(payload.challenges ?? []);
      }
    } catch {
      // Challenge prompts are best-effort; the game route still enforces access.
    }
  }, []);

  const navigateToWar = useCallback(
    (warId: string) => {
      onNavigate?.();
      window.sessionStorage.setItem(`rave-war-opened:${warId}`, "1");
      window.location.assign(`/rave-wars/${warId}`);
    },
    [onNavigate]
  );

  useEffect(() => {
    const activeChallenge = challenges.find((challenge) => challenge.status === "active");

    if (!activeChallenge) {
      return;
    }

    const activePath = `/rave-wars/${activeChallenge.id}`;

    if (window.location.pathname === activePath || window.sessionStorage.getItem(`rave-war-opened:${activeChallenge.id}`) === "1") {
      return;
    }

    navigateToWar(activeChallenge.id);
  }, [challenges, navigateToWar]);

  const submitChallengeAction = useCallback(
    async (challenge: RaveWarChallengeSummary, action: "accept" | "cancel" | "decline") => {
      setBusyWarId(challenge.id);

      try {
        const response = await fetch("/api/rave-wars/challenges", {
          body: JSON.stringify({
            action,
            warId: challenge.id
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });

        if (response.ok && action === "accept") {
          navigateToWar(challenge.id);
          return;
        }

        await refreshChallenges();
      } finally {
        setBusyWarId(null);
      }
    },
    [navigateToWar, refreshChallenges]
  );

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshChallenges, 0);
    const interval = window.setInterval(refreshChallenges, pollMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshChallenges();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshChallenges]);

  if (!visibleChallenges.length) {
    return null;
  }

  const content = (
    <div className="grid gap-2">
      {visibleChallenges.map((challenge) => {
        const busy = busyWarId === challenge.id;
        const isTarget = challenge.currentUserRole === "target";
        const isActive = challenge.status === "active";

        return (
          <article className="rounded-md border border-bc-line bg-bc-ink p-3" key={challenge.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("text-xs font-black uppercase", isActive ? "text-bc-acid" : "text-bc-electric")}>
                  {isActive ? "Active Rave War" : "Rave War Challenge"}
                </p>
                <p className="mt-1 break-words text-sm font-black text-white">{challengeLabel(challenge)}</p>
                <p className="mt-1 text-xs text-bc-muted">
                  {challenge.levelName} in #{challenge.roomSlug}
                </p>
              </div>
              {!isActive ? (
                <button
                  aria-label="Hide Rave War challenge"
                  className="bc-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-md border border-bc-line text-bc-muted transition hover:text-white"
                  onClick={() => {
                    setDismissedIds((ids) => new Set(ids).add(challenge.id));
                  }}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {isActive ? (
                <Button className="min-h-8 px-3 text-xs" onClick={() => navigateToWar(challenge.id)} size="sm" type="button">
                  Open Battle
                </Button>
              ) : isTarget ? (
                <>
                  <Button
                    className="min-h-8 px-3 text-xs"
                    disabled={busy}
                    onClick={() => void submitChallengeAction(challenge, "accept")}
                    size="sm"
                    type="button"
                  >
                    Accept
                  </Button>
                  <Button
                    className="min-h-8 px-3 text-xs"
                    disabled={busy}
                    onClick={() => void submitChallengeAction(challenge, "decline")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Decline
                  </Button>
                </>
              ) : (
                <>
                  <Button className="min-h-8 px-3 text-xs" onClick={() => navigateToWar(challenge.id)} size="sm" type="button">
                    Open
                  </Button>
                  <Button
                    className="min-h-8 px-3 text-xs"
                    disabled={busy}
                    onClick={() => void submitChallengeAction(challenge, "cancel")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  if (placement === "mobile-menu") {
    return (
      <section className="mt-3 rounded-md border border-bc-electric/30 bg-bc-electric/5">
        <button
          aria-expanded={expanded}
          className="bc-focus-ring flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm font-black text-white"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <Swords className="h-4 w-4 shrink-0 text-bc-electric" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Rave Wars</span>
          <span className="rounded bg-bc-pink/15 px-1.5 py-0.5 text-[11px] font-black text-bc-pink">
            {activeCount ? `${activeCount} active` : visibleChallenges.length}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition", expanded && "rotate-180")} aria-hidden="true" />
        </button>
        {expanded ? <div className="border-t border-bc-line/70 p-2">{content}</div> : null}
      </section>
    );
  }

  return (
    <div className="relative hidden lg:block">
      <button
        aria-expanded={expanded}
        className="bc-focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border border-bc-electric/35 bg-bc-electric/10 px-3 text-xs font-black text-white transition hover:border-bc-electric/70"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <Swords className="h-4 w-4 text-bc-electric" aria-hidden="true" />
        Wars
        <span className="rounded bg-bc-pink px-1.5 py-0.5 text-[10px] text-white">{activeCount || visibleChallenges.length}</span>
      </button>
      {expanded ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[72] w-[min(24rem,calc(100vw-2rem))] rounded-md border border-bc-line bg-bc-void/98 p-3 shadow-2xl shadow-black/45 backdrop-blur">
          {content}
        </div>
      ) : null}
    </div>
  );
}

export function RaveWarChallengeOverlay() {
  return <RaveWarChallengeLauncher placement="desktop" />;
}
