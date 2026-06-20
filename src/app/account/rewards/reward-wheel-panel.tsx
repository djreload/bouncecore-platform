"use client";

import type { CSSProperties } from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Coins, Gift, RotateCw, Sparkles, Trophy, Zap } from "lucide-react";
import { accountRewardWheelAction } from "@/app/account/rewards/actions";
import {
  initialAccountRewardWheelActionState,
  type AccountRewardWheelActionState
} from "@/app/account/rewards/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AccountRewardWheelRow, AccountRewardWheelsData } from "@/lib/rewards/prize-service";

type RewardWheelPanelProps = {
  data: AccountRewardWheelsData;
};

const wheelPalette = ["#00d5ff", "#ff2bd6", "#b6ff2e", "#ffb020", "#8b5cf6", "#f7fbff"];
const marqueeLights = Array.from({ length: 28 }, (_, index) => index);
const minimumSpinMs = 2200;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 16)}...` : value;
}

function segmentGradient(wheel: AccountRewardWheelRow) {
  if (!wheel.totalWeight || !wheel.segments.length) {
    return "conic-gradient(#171a2a 0deg 360deg)";
  }

  let cursor = 0;
  const stops = wheel.segments.map((segment, index) => {
    const start = (cursor / wheel.totalWeight) * 360;
    cursor += segment.weight;
    const end = (cursor / wheel.totalWeight) * 360;
    const color = wheelPalette[index % wheelPalette.length];

    return `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function wheelStyle(wheel: AccountRewardWheelRow): CSSProperties {
  return {
    "--bc-reward-wheel-bg": segmentGradient(wheel)
  } as CSSProperties;
}

function segmentLabelStyles(wheel: AccountRewardWheelRow) {
  let cursor = 0;

  return wheel.segments.map((segment, index) => {
    const midpoint = wheel.totalWeight > 0 ? ((cursor + segment.weight / 2) / wheel.totalWeight) * 360 : 0;
    cursor += segment.weight;

    return {
      segment,
      style: {
        "--bc-reward-segment-angle": `${midpoint.toFixed(2)}deg`,
        "--bc-reward-segment-angle-negative": `${(-midpoint).toFixed(2)}deg`,
        "--bc-reward-segment-color": wheelPalette[index % wheelPalette.length]
      } as CSSProperties
    };
  });
}

function statusTone(status: string) {
  if (status === "fulfilled" || status === "approved") {
    return "acid" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  if (status === "rejected") {
    return "pink" as const;
  }

  return "muted" as const;
}

function prizeTone(prizeType: string) {
  if (prizeType === "none") {
    return "muted" as const;
  }

  if (prizeType === "vip") {
    return "amber" as const;
  }

  return "pink" as const;
}

export function RewardWheelPanel({ data }: RewardWheelPanelProps) {
  const [state, formAction, pending] = useActionState<AccountRewardWheelActionState, FormData>(
    accountRewardWheelAction,
    initialAccountRewardWheelActionState
  );
  const [selectedWheelId, setSelectedWheelId] = useState<string | null>(data.wheels[0]?.id ?? null);
  const [visualSpinWheelId, setVisualSpinWheelId] = useState<string | null>(null);
  const [spinStartedAt, setSpinStartedAt] = useState(0);
  const selectedWheel = data.wheels.find((wheel) => wheel.id === selectedWheelId) ?? data.wheels[0] ?? null;
  const hasWheels = data.wheels.length > 0;
  const selectedSegmentLabels = selectedWheel ? segmentLabelStyles(selectedWheel) : [];
  const activeResult = !visualSpinWheelId && state.result && state.result.wheelId === selectedWheel?.id ? state.result : null;
  const gameIsSpinning = Boolean(visualSpinWheelId) || pending;
  const resultMessage = gameIsSpinning ? "Spinning..." : state.message || "Ready to spin";
  const recentClaimsLabel = useMemo(
    () => `${data.recentClaims.length} recent ${data.recentClaims.length === 1 ? "spin" : "spins"}`,
    [data.recentClaims.length]
  );

  useEffect(() => {
    if (!visualSpinWheelId || state.status === "idle" || pending) {
      return;
    }

    const remainingMs = Math.max(700, minimumSpinMs - (Date.now() - spinStartedAt));
    const timeout = window.setTimeout(() => setVisualSpinWheelId(null), remainingMs);

    return () => window.clearTimeout(timeout);
  }, [pending, spinStartedAt, state.status, visualSpinWheelId]);

  if (!hasWheels || !selectedWheel) {
    return (
      <section className="bc-reward-casino rounded-md border border-bc-line bg-bc-panel p-5">
        <article className="rounded-md border border-bc-line bg-bc-ink p-5">
          <Gift className="h-7 w-7 text-bc-electric" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-black">No active wheels yet</h3>
          <p className="mt-2 text-sm text-bc-muted">Activate a configured wheel in admin once the prize segments are ready.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="bc-reward-casino overflow-hidden rounded-md border border-bc-line bg-bc-panel">
      <div className="bc-reward-casino-marquee border-b border-bc-line p-5">
        <div className="bc-reward-marquee-lights" aria-hidden="true">
          {marqueeLights.map((light) => (
            <span key={light} />
          ))}
        </div>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Rewards casino</Badge>
            <h3 className="mt-4 text-3xl font-black">Spin the Bouncecore Wheel</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              A live prize game backed by admin-controlled weighted segments, cooldowns, and fulfilment claims.
            </p>
          </div>
          <div className="rounded-md border border-bc-acid/30 bg-bc-acid/10 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase text-bc-muted">Wallet</p>
            <p className="text-2xl font-black text-bc-acid">{data.walletBalance.toLocaleString("en-GB")}</p>
            <p className="text-xs text-bc-muted">stars</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="bc-reward-game-floor rounded-md border border-bc-line bg-bc-ink p-4 sm:p-5">
          {data.wheels.length > 1 ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {data.wheels.map((wheel) => (
                <button
                  className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                    wheel.id === selectedWheel.id
                      ? "border-bc-acid bg-bc-acid/15 text-bc-acid"
                      : "border-bc-line bg-white/5 text-bc-muted hover:border-bc-electric/60 hover:text-white"
                  }`}
                  key={wheel.id}
                  onClick={() => setSelectedWheelId(wheel.id)}
                  type="button"
                >
                  {wheel.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid items-center gap-6 lg:grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
            <div className="bc-reward-machine">
              <div className="bc-reward-machine-top" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="bc-reward-wheel-frame">
                <div className="bc-reward-wheel-pointer" aria-hidden="true">
                  <Zap className="h-5 w-5" />
                </div>
                <div
                  aria-label={`${selectedWheel.name} weighted prize wheel`}
                  className={`bc-reward-wheel ${gameIsSpinning ? "bc-reward-wheel-spinning" : ""} ${activeResult ? "bc-reward-wheel-winner" : ""}`}
                  role="img"
                  style={wheelStyle(selectedWheel)}
                >
                  {selectedSegmentLabels.map(({ segment, style }) => (
                    <span className="bc-reward-wheel-segment-label" key={segment.id} style={style}>
                      {shortLabel(segment.label)}
                    </span>
                  ))}
                  <div className="bc-reward-wheel-hub">
                    <Sparkles className="h-7 w-7" aria-hidden="true" />
                    <span>SPIN</span>
                  </div>
                </div>
              </div>
              <form
                action={formAction}
                className="mt-5"
                onSubmit={() => {
                  setSelectedWheelId(selectedWheel.id);
                  setVisualSpinWheelId(selectedWheel.id);
                  setSpinStartedAt(Date.now());
                }}
              >
                <input name="wheelId" type="hidden" value={selectedWheel.id} />
                <Button
                  className="bc-reward-spin-button w-full"
                  disabled={pending || gameIsSpinning || !selectedWheel.canSpin}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  <RotateCw className="h-5 w-5" aria-hidden="true" />
                  {gameIsSpinning ? "Spinning" : "Spin now"}
                </Button>
              </form>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge tone="cyan">{selectedWheel.totalWeight} weight</Badge>
                <Badge tone={selectedWheel.costStars > 0 ? "amber" : "acid"}>
                  {selectedWheel.costStars > 0 ? `${selectedWheel.costStars} stars` : "Free spin"}
                </Badge>
                {selectedWheel.cooldownMinutes > 0 ? <Badge tone="muted">{selectedWheel.cooldownMinutes}m cooldown</Badge> : null}
              </div>
              <h4 className="mt-4 text-2xl font-black">{selectedWheel.name}</h4>
              <p className="mt-2 text-sm text-bc-muted">{selectedWheel.description ?? "No wheel description set."}</p>

              <div
                className={`mt-5 rounded-md border p-4 ${
                  state.status === "error" && !gameIsSpinning
                    ? "border-bc-pink/30 bg-bc-pink/10"
                    : activeResult
                      ? "border-bc-acid/30 bg-bc-acid/10"
                      : "border-bc-line bg-bc-panel"
                }`}
              >
                <p className="text-xs font-semibold uppercase text-bc-muted">Game result</p>
                <p className={`mt-2 text-2xl font-black ${state.status === "error" && !gameIsSpinning ? "text-bc-pink" : "text-white"}`}>
                  {activeResult ? activeResult.segmentLabel : resultMessage}
                </p>
                <p className="mt-2 text-sm text-bc-muted">
                  {activeResult
                    ? activeResult.status === "pending"
                      ? "Prize claim created and waiting for admin fulfilment."
                      : "Result saved to your spin history."
                    : selectedWheel.unavailableReason ?? "The wheel will stop on a weighted prize segment."}
                </p>
              </div>

              <div className="mt-5 grid gap-2">
                {selectedWheel.segments.map((segment, index) => (
                  <div
                    className={`bc-reward-payline flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                      activeResult?.segmentId === segment.id ? "border-bc-acid bg-bc-acid/10" : "border-bc-line bg-bc-panel"
                    }`}
                    key={segment.id}
                    style={{ "--bc-reward-segment-color": wheelPalette[index % wheelPalette.length] } as CSSProperties}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{segment.label}</p>
                      <p className="text-xs text-bc-muted">{segment.weight} weight</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={prizeTone(segment.prizeType)}>{segment.prizeType}</Badge>
                      <span className="text-xs font-black text-bc-acid">{segment.oddsPercent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <h4 className="font-black">Machine status</h4>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-bc-line bg-bc-panel px-3 py-2">
                <span className="text-bc-muted">Selected wheel</span>
                <span className="font-black">{selectedWheel.name}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-bc-line bg-bc-panel px-3 py-2">
                <span className="text-bc-muted">Spin cost</span>
                <span className="font-black">{selectedWheel.costStars > 0 ? `${selectedWheel.costStars} stars` : "Free"}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-bc-line bg-bc-panel px-3 py-2">
                <span className="text-bc-muted">State</span>
                <span className={selectedWheel.canSpin ? "font-black text-bc-acid" : "font-black text-bc-amber"}>
                  {selectedWheel.canSpin ? "Ready" : "Locked"}
                </span>
              </div>
            </div>
          </article>

          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <h4 className="font-black">Recent spins</h4>
            </div>
            <p className="mt-2 text-sm text-bc-muted">{recentClaimsLabel} in your account.</p>
            <div className="mt-4 grid max-h-[440px] gap-3 overflow-y-auto pr-1">
              {data.recentClaims.map((claim) => (
                <article className="rounded-md border border-bc-line bg-bc-panel p-3" id={`reward-claim-${claim.id}`} key={claim.id}>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(claim.status)}>{claim.status}</Badge>
                    <Badge tone={prizeTone(claim.prizeType)}>{claim.prizeType}</Badge>
                  </div>
                  <h5 className="mt-3 font-black">{claim.title}</h5>
                  <p className="mt-1 text-xs text-bc-muted">
                    {claim.wheelName ?? "Reward wheel"} / {formatDate(claim.createdAt)}
                  </p>
                </article>
              ))}
              {!data.recentClaims.length ? (
                <div className="rounded-md border border-bc-line bg-bc-panel p-4 text-sm text-bc-muted">
                  No reward wheel spins yet.
                </div>
              ) : null}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
