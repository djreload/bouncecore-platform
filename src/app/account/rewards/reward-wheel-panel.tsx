"use client";

import type { CSSProperties } from "react";
import { useActionState, useMemo, useState } from "react";
import { Gift, RotateCw, Sparkles, Trophy } from "lucide-react";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
  const [activeWheelId, setActiveWheelId] = useState<string | null>(null);
  const activeResultWheelId = state.result?.wheelId ?? null;
  const hasWheels = data.wheels.length > 0;
  const resultLabel = state.result?.segmentLabel;
  const wheelCountLabel = useMemo(() => `${data.wheels.length} active ${data.wheels.length === 1 ? "wheel" : "wheels"}`, [data.wheels.length]);

  return (
    <section className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="acid">Rewards wheel</Badge>
          <h3 className="mt-4 text-2xl font-black">Spin for site rewards</h3>
          <p className="mt-2 max-w-3xl text-sm text-bc-muted">
            Active wheels use weighted prize segments from admin. Wins that need fulfilment are sent to the prize claims queue.
          </p>
        </div>
        <div className="rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm font-black text-bc-acid">
          {data.walletBalance.toLocaleString("en-GB")} stars
        </div>
      </div>

      {state.message ? (
        <div
          className={`mt-5 rounded-md border p-3 text-sm ${
            state.status === "error"
              ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
              : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {hasWheels ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4 lg:grid-cols-2">
            {data.wheels.map((wheel) => {
              const isSpinning = pending && activeWheelId === wheel.id;
              const isWinner = !pending && activeResultWheelId === wheel.id;

              return (
                <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={wheel.id}>
                  <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                    <div
                      aria-label={`${wheel.name} weighted prize wheel`}
                      className={`bc-reward-wheel ${isSpinning ? "bc-reward-wheel-spinning" : ""} ${isWinner ? "bc-reward-wheel-winner" : ""}`}
                      role="img"
                      style={wheelStyle(wheel)}
                    >
                      <div className="bc-reward-wheel-marker" />
                      <div className="bc-reward-wheel-hub">
                        <Sparkles className="h-6 w-6" aria-hidden="true" />
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="cyan">{wheel.totalWeight} weight</Badge>
                        <Badge tone={wheel.costStars > 0 ? "amber" : "acid"}>{wheel.costStars > 0 ? `${wheel.costStars} stars` : "Free spin"}</Badge>
                        {wheel.cooldownMinutes > 0 ? <Badge tone="muted">{wheel.cooldownMinutes}m cooldown</Badge> : null}
                      </div>
                      <h4 className="mt-3 text-xl font-black">{wheel.name}</h4>
                      <p className="mt-2 text-sm text-bc-muted">{wheel.description ?? "No wheel description set."}</p>
                      {isWinner && resultLabel ? (
                        <div className="mt-3 rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3 text-sm font-black text-bc-acid">
                          Result: {resultLabel}
                        </div>
                      ) : null}
                      {wheel.unavailableReason ? (
                        <p className="mt-3 text-sm text-bc-muted">{wheel.unavailableReason}</p>
                      ) : null}
                      <form action={formAction} className="mt-4" onSubmit={() => setActiveWheelId(wheel.id)}>
                        <input name="wheelId" type="hidden" value={wheel.id} />
                        <Button disabled={pending || !wheel.canSpin} type="submit" variant="primary">
                          <RotateCw className="h-4 w-4" aria-hidden="true" />
                          {isSpinning ? "Spinning" : "Spin wheel"}
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {wheel.segments.map((segment) => (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm" key={segment.id}>
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
                </article>
              );
            })}
          </div>

          <aside className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <h4 className="font-black">Recent spins</h4>
            </div>
            <p className="mt-2 text-sm text-bc-muted">{wheelCountLabel} available.</p>
            <div className="mt-4 grid gap-3">
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
          </aside>
        </div>
      ) : (
        <article className="mt-5 rounded-md border border-bc-line bg-bc-ink p-5">
          <Gift className="h-7 w-7 text-bc-electric" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-black">No active wheels yet</h3>
          <p className="mt-2 text-sm text-bc-muted">Activate a configured wheel in admin once the prize segments are ready.</p>
        </article>
      )}
    </section>
  );
}
