"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown, Clock3, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePerformancePreferences } from "@/components/performance/use-performance-preferences";
import type { RaveWarChallengeSummary } from "@/lib/rave-wars/rave-war-types";
import { cn } from "@/lib/utils";

type ChallengePayload = {
  challenges?: RaveWarChallengeSummary[];
  error?: string;
};

type ChallengeAction = "accept" | "cancel" | "decline";

type RaveWarChallengeContextValue = {
  actionError: string | null;
  busyWarId: string | null;
  challenges: RaveWarChallengeSummary[];
  navigateToWar: (warId: string) => void;
  submitChallengeAction: (challenge: RaveWarChallengeSummary, action: ChallengeAction) => Promise<void>;
};

type RaveWarChallengeLauncherProps = {
  onNavigate?: () => void;
  placement?: "desktop" | "mobile-menu";
};

const pollMs = 2500;
const RaveWarChallengeContext = createContext<RaveWarChallengeContextValue | null>(null);

function challengeLabel(challenge: RaveWarChallengeSummary) {
  return `${challenge.challengerDisplayName} vs ${challenge.targetDisplayName}`;
}

function challengeExpiryLabel(expiresAt: string) {
  const date = new Date(expiresAt);

  if (Number.isNaN(date.getTime())) {
    return "Respond before this invitation expires.";
  }

  return `Invitation expires at ${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)}.`;
}

function useRaveWarChallengeContext() {
  const value = useContext(RaveWarChallengeContext);

  if (!value) {
    throw new Error("Rave War challenge controls must be inside RaveWarChallengeProvider.");
  }

  return value;
}

export function RaveWarChallengeProvider({ children }: { children: ReactNode }) {
  const { effective: performancePreferences } = usePerformancePreferences();
  const [challenges, setChallenges] = useState<RaveWarChallengeSummary[]>([]);
  const [busyWarId, setBusyWarId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const navigateToWar = useCallback((warId: string) => {
    window.sessionStorage.setItem(`rave-war-opened:${warId}`, "1");
    window.location.assign(`/rave-wars/${warId}`);
  }, []);

  const submitChallengeAction = useCallback(
    async (challenge: RaveWarChallengeSummary, action: ChallengeAction) => {
      setBusyWarId(challenge.id);
      setActionError(null);

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
        const payload = (await response.json().catch(() => ({}))) as ChallengePayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Rave War invitation could not be updated.");
        }

        if (action === "accept") {
          navigateToWar(challenge.id);
          return;
        }

        await refreshChallenges();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Rave War invitation could not be updated.");
      } finally {
        setBusyWarId(null);
      }
    },
    [navigateToWar, refreshChallenges]
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

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshChallenges, 0);
    const interval = window.setInterval(
      refreshChallenges,
      performancePreferences.realtimeUpdatesEnabled ? pollMs : 10_000
    );

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
  }, [performancePreferences.realtimeUpdatesEnabled, refreshChallenges]);

  return (
    <RaveWarChallengeContext.Provider
      value={{ actionError, busyWarId, challenges, navigateToWar, submitChallengeAction }}
    >
      {children}
    </RaveWarChallengeContext.Provider>
  );
}

export function RaveWarChallengeLauncher({ onNavigate, placement = "desktop" }: RaveWarChallengeLauncherProps) {
  const { actionError, busyWarId, challenges, navigateToWar, submitChallengeAction } = useRaveWarChallengeContext();
  const [expanded, setExpanded] = useState(false);
  const activeCount = challenges.filter((challenge) => challenge.status === "active").length;

  if (!challenges.length) {
    return null;
  }

  function openWar(warId: string) {
    onNavigate?.();
    navigateToWar(warId);
  }

  const content = (
    <div className="grid gap-2">
      {actionError ? (
        <p className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-xs font-semibold text-red-100" role="alert">
          {actionError}
        </p>
      ) : null}
      {challenges.map((challenge) => {
        const busy = busyWarId === challenge.id;
        const isTarget = challenge.currentUserRole === "target";
        const isActive = challenge.status === "active";

        return (
          <article className="rounded-md border border-bc-line bg-bc-ink p-3" key={challenge.id}>
            <div className="min-w-0">
              <p className={cn("text-xs font-black uppercase", isActive ? "text-bc-acid" : "text-bc-electric")}>
                {isActive ? "Active Rave War" : "Rave War Challenge"}
              </p>
              <p className="mt-1 break-words text-sm font-black text-white">{challengeLabel(challenge)}</p>
              <p className="mt-1 text-xs text-bc-muted">
                {challenge.levelName} in #{challenge.roomSlug}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {isActive ? (
                <Button className="min-h-8 px-3 text-xs" onClick={() => openWar(challenge.id)} size="sm" type="button">
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
                  <Button className="min-h-8 px-3 text-xs" onClick={() => openWar(challenge.id)} size="sm" type="button">
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
            {activeCount ? `${activeCount} active` : challenges.length}
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
        <span className="rounded bg-bc-pink px-1.5 py-0.5 text-[10px] text-white">{activeCount || challenges.length}</span>
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
  const { actionError, busyWarId, challenges, submitChallengeAction } = useRaveWarChallengeContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pendingInvite = challenges.find(
    (challenge) => challenge.status === "pending" && challenge.currentUserRole === "target"
  );

  useEffect(() => {
    if (!pendingInvite) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLButtonElement>("[data-rave-war-accept]")?.focus()
    );

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = controls[0];
      const last = controls.at(-1);

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keepFocusInside);
      previouslyFocused?.focus();
    };
  }, [pendingInvite]);

  if (!pendingInvite) {
    return null;
  }

  const busy = busyWarId === pendingInvite.id;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-black/75 p-4 text-white backdrop-blur-sm">
      <div
        aria-describedby="rave-war-invite-description"
        aria-labelledby="rave-war-invite-title"
        aria-modal="true"
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-md border border-bc-electric/60 bg-bc-void shadow-[0_28px_100px_rgba(0,0,0,0.78),0_0_55px_rgba(0,213,255,0.18)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-b border-bc-line bg-bc-electric/10 px-5 py-4 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-bc-electric/60 bg-bc-electric/10 text-bc-electric">
            <Swords className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-xs font-black uppercase text-bc-electric">Incoming challenge</p>
          <h2 className="mt-1 text-2xl font-black" id="rave-war-invite-title">
            {pendingInvite.challengerDisplayName} challenged you
          </h2>
        </div>
        <div className="p-5 text-center">
          <p className="text-sm leading-6 text-bc-muted" id="rave-war-invite-description">
            Accept to enter <strong className="text-white">{pendingInvite.levelName}</strong> with {pendingInvite.challengerDisplayName},
            or decline the invitation.
          </p>
          <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-3">
            <p className="font-black text-white">{challengeLabel(pendingInvite)}</p>
            <p className="mt-1 text-xs text-bc-muted">#{pendingInvite.roomSlug}</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-bc-muted">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {challengeExpiryLabel(pendingInvite.expiresAt)}
            </p>
          </div>
          {actionError ? (
            <p className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm font-semibold text-red-100" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              disabled={busy}
              onClick={() => void submitChallengeAction(pendingInvite, "decline")}
              size="md"
              type="button"
              variant="ghost"
            >
              {busy ? "Please wait" : "Decline"}
            </Button>
            <Button
              data-rave-war-accept
              disabled={busy}
              onClick={() => void submitChallengeAction(pendingInvite, "accept")}
              size="md"
              type="button"
            >
              {busy ? "Please wait" : "Accept war"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-bc-muted">This invitation stays here until you accept, decline, or it expires.</p>
        </div>
      </div>
    </div>
  );
}
