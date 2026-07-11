"use client";

import { useCallback, useEffect, useState } from "react";
import { Swords, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { RaveWarChallengeSummary } from "@/lib/rave-wars/rave-war-types";

type ChallengePayload = {
  challenges?: RaveWarChallengeSummary[];
  error?: string;
};

const pollMs = 5000;

export function RaveWarChallengeOverlay() {
  const [challenges, setChallenges] = useState<RaveWarChallengeSummary[]>([]);
  const [busyWarId, setBusyWarId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const visibleChallenge = challenges.find((challenge) => challenge.status === "active" || !dismissedIds.has(challenge.id));

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

  const submitChallengeAction = useCallback(async (challenge: RaveWarChallengeSummary, action: "accept" | "cancel" | "decline") => {
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
        window.sessionStorage.setItem(`rave-war-opened:${challenge.id}`, "1");
        window.location.assign(`/rave-wars/${challenge.id}`);
        return;
      }

      await refreshChallenges();
    } finally {
      setBusyWarId(null);
    }
  }, [refreshChallenges]);

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

  useEffect(() => {
    const activeChallenge = challenges.find((challenge) => challenge.status === "active");

    if (!activeChallenge || window.location.pathname.startsWith(`/rave-wars/${activeChallenge.id}`)) {
      return;
    }

    const storageKey = `rave-war-opened:${activeChallenge.id}`;

    if (window.sessionStorage.getItem(storageKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(storageKey, "1");
    window.location.assign(`/rave-wars/${activeChallenge.id}`);
  }, [challenges]);

  if (!visibleChallenge) {
    return null;
  }

  const busy = busyWarId === visibleChallenge.id;
  const isTarget = visibleChallenge.currentUserRole === "target";
  const isActive = visibleChallenge.status === "active";

  return (
    <div className="fixed bottom-4 right-4 z-[74] w-[min(24rem,calc(100vw-2rem))] rounded-md border border-bc-electric/40 bg-bc-void/95 p-3 text-white shadow-2xl shadow-black/45 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric">
          <Swords className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-bc-electric">{isActive ? "Active Rave War" : "Rave War"}</p>
              <p className="mt-1 break-words text-sm font-semibold">
                {visibleChallenge.challengerDisplayName} vs {visibleChallenge.targetDisplayName}
              </p>
            </div>
            {!isActive ? (
              <button
                aria-label="Dismiss Rave War prompt"
                className="bc-focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-md border border-bc-line text-bc-muted transition hover:text-white"
                onClick={() => {
                  setDismissedIds((ids) => new Set(ids).add(visibleChallenge.id));
                }}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-bc-muted">
            {visibleChallenge.levelName} in #{visibleChallenge.roomSlug}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isActive ? (
              <ButtonLink className="min-h-8 px-3 text-xs" href={`/rave-wars/${visibleChallenge.id}`} size="sm">
                Open Battle
              </ButtonLink>
            ) : isTarget ? (
              <>
                <Button
                  className="min-h-8 px-3 text-xs"
                  disabled={busy}
                  onClick={() => void submitChallengeAction(visibleChallenge, "accept")}
                  size="sm"
                  type="button"
                >
                  Accept
                </Button>
                <Button
                  className="min-h-8 px-3 text-xs"
                  disabled={busy}
                  onClick={() => void submitChallengeAction(visibleChallenge, "decline")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Decline
                </Button>
              </>
            ) : (
              <>
                <ButtonLink className="min-h-8 px-3 text-xs" href={`/rave-wars/${visibleChallenge.id}`} size="sm">
                  Open
                </ButtonLink>
                <Button
                  className="min-h-8 px-3 text-xs"
                  disabled={busy}
                  onClick={() => void submitChallengeAction(visibleChallenge, "cancel")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
