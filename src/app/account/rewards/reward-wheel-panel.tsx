"use client";

import type { CSSProperties } from "react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Coins, Gem, Gift, Music, Sparkles, Star, Trophy } from "lucide-react";
import { accountRewardWheelAction } from "@/app/account/rewards/actions";
import {
  initialAccountRewardWheelActionState,
  type AccountRewardWheelActionState
} from "@/app/account/rewards/state";
import { Badge } from "@/components/ui/badge";
import type { AccountRewardWheelRow, AccountRewardWheelsData, RewardWheelSpinResult } from "@/lib/rewards/prize-service";

type RewardWheelPanelProps = {
  data: AccountRewardWheelsData;
};

type SegmentSlice = AccountRewardWheelRow["segments"][number] & {
  angle: number;
  color: string;
  endAngle: number;
  labelFontSize: string;
  labelIconSize: string;
  labelRadius: string;
  labelScale: number;
  labelWidth: string;
  midpointAngle: number;
  startAngle: number;
};

const wheelPalette = ["#ffc928", "#64b71f", "#e22d70", "#0569c9", "#ff8517", "#6d34b8", "#009b9a", "#df2718"];
const bulbIndexes = Array.from({ length: 40 }, (_, index) => index);
const minimumSpinMs = 7200;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 20)}...` : value;
}

function twoLineLabel(value: string) {
  const words = value.trim().split(/\s+/);

  if (words.length <= 1) {
    return shortLabel(value);
  }

  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
}

function wheelSlices(wheel: AccountRewardWheelRow): SegmentSlice[] {
  let cursor = 0;

  return wheel.segments.map((segment, index) => {
    const startAngle = wheel.totalWeight > 0 ? (cursor / wheel.totalWeight) * 360 : 0;
    cursor += segment.weight;
    const endAngle = wheel.totalWeight > 0 ? (cursor / wheel.totalWeight) * 360 : 0;
    const angle = Math.max(0, endAngle - startAngle);
    const labelScale = Math.max(0.54, Math.min(1.12, Math.sqrt(angle / 72)));
    const labelWidth = `${Math.round(Math.max(42, Math.min(150, 40 + angle * 1.18)))}px`;
    const normalizedScale = (labelScale - 0.54) / (1.12 - 0.54);

    return {
      ...segment,
      angle,
      color: wheelPalette[index % wheelPalette.length],
      endAngle,
      labelFontSize: `${Math.round(8 + normalizedScale * 14)}px`,
      labelIconSize: `${Math.round(18 + normalizedScale * 44)}px`,
      labelRadius: angle < 24 ? "-31.5cqw" : angle < 50 ? "-30.5cqw" : "-29cqw",
      labelScale,
      labelWidth,
      midpointAngle: startAngle + (endAngle - startAngle) / 2,
      startAngle
    };
  });
}

function segmentGradient(slices: SegmentSlice[]) {
  if (!slices.length) {
    return "conic-gradient(#171a2a 0deg 360deg)";
  }

  return `conic-gradient(${slices
    .map((slice) => `${slice.color} ${slice.startAngle.toFixed(2)}deg ${slice.endAngle.toFixed(2)}deg`)
    .join(", ")})`;
}

function segmentDividerGradient(slices: SegmentSlice[]) {
  if (slices.length <= 1) {
    return "none";
  }

  const halfLineWidth = 0.56;
  const boundaries = slices
    .map((slice) => slice.startAngle)
    .filter((angle) => angle > 0.01 && angle < 359.99)
    .sort((a, b) => a - b);
  const stops: string[] = [];
  let cursor = 0;

  for (const boundary of boundaries) {
    const start = Math.max(cursor, boundary - halfLineWidth);
    const end = Math.min(360, boundary + halfLineWidth);

    if (start > cursor) {
      stops.push(`transparent ${cursor.toFixed(2)}deg ${start.toFixed(2)}deg`);
    }

    stops.push(`rgba(255, 255, 255, 0.34) ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
    cursor = end;
  }

  if (cursor < 360) {
    stops.push(`transparent ${cursor.toFixed(2)}deg 360deg`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

function wheelStyle(slices: SegmentSlice[], rotation: number): CSSProperties {
  return {
    "--bc-reward-wheel-dividers": segmentDividerGradient(slices),
    "--bc-reward-wheel-bg": segmentGradient(slices),
    transform: `rotate(${rotation}deg)`
  } as CSSProperties;
}

function labelStyle(slice: SegmentSlice): CSSProperties {
  return {
    "--bc-reward-segment-angle": `${slice.midpointAngle.toFixed(2)}deg`,
    "--bc-reward-segment-angle-negative": `${(-slice.midpointAngle).toFixed(2)}deg`,
    "--bc-reward-segment-color": slice.color,
    "--bc-reward-segment-font-size": slice.labelFontSize,
    "--bc-reward-segment-icon-size": slice.labelIconSize,
    "--bc-reward-segment-label-radius": slice.labelRadius,
    "--bc-reward-segment-label-scale": slice.labelScale.toFixed(2),
    "--bc-reward-segment-label-width": slice.labelWidth
  } as CSSProperties;
}

function calculateWinningRotation(currentRotation: number, slices: SegmentSlice[], segmentId: string) {
  const winningSlice = slices.find((slice) => slice.id === segmentId);
  const fallbackSlice = slices[0];
  const slice = winningSlice ?? fallbackSlice;

  if (!slice) {
    return currentRotation + 2160;
  }

  const sliceAngle = Math.max(6, slice.endAngle - slice.startAngle);
  const safeOffset = (Math.random() - 0.5) * (sliceAngle * 0.34);
  const fullRotations = 6 + Math.floor(Math.random() * 4);
  const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
  const targetWithinCircle = 360 - slice.midpointAngle + safeOffset;
  const delta = ((targetWithinCircle - normalizedCurrent + 360) % 360) + fullRotations * 360;

  return currentRotation + delta;
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

function prizeIconForType(prizeType: string) {
  if (prizeType === "merch") {
    return Gift;
  }

  if (prizeType === "music") {
    return Music;
  }

  if (prizeType === "vip") {
    return Gem;
  }

  if (prizeType === "manual") {
    return Trophy;
  }

  return Star;
}

export function RewardWheelPanel({ data }: RewardWheelPanelProps) {
  const [state, formAction, pending] = useActionState<AccountRewardWheelActionState, FormData>(
    accountRewardWheelAction,
    initialAccountRewardWheelActionState
  );
  const [selectedWheelId, setSelectedWheelId] = useState<string | null>(data.wheels[0]?.id ?? null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isLanding, setIsLanding] = useState(false);
  const [landedResult, setLandedResult] = useState<RewardWheelSpinResult | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const handledClaimId = useRef<string | null>(null);
  const animationTimer = useRef<number | null>(null);
  const selectedWheel = data.wheels.find((wheel) => wheel.id === selectedWheelId) ?? data.wheels[0] ?? null;
  const selectedSlices = useMemo(() => (selectedWheel ? wheelSlices(selectedWheel) : []), [selectedWheel]);
  const hasWheels = data.wheels.length > 0;
  const isBusy = pending || isLanding;
  const currentResult = landedResult && landedResult.wheelId === selectedWheel?.id ? landedResult : null;
  const resultTitle = pending
    ? "Drawing..."
    : isLanding
      ? "Spinning..."
      : currentResult?.segmentLabel ?? (state.status === "error" ? "Try again" : "Ready?");
  const resultSubtitle = pending
    ? "Checking the live prize rules."
    : isLanding
      ? "Good luck."
      : currentResult
        ? currentResult.status === "pending"
          ? "Prize claim created and waiting for admin fulfilment."
          : "Result saved to your spin history."
        : state.status === "error"
          ? state.message
          : selectedWheel?.unavailableReason ?? "Press the middle button to spin.";
  const recentClaimsLabel = useMemo(
    () => `${data.recentClaims.length} recent ${data.recentClaims.length === 1 ? "spin" : "spins"}`,
    [data.recentClaims.length]
  );

  useEffect(() => {
    return () => {
      if (animationTimer.current) {
        window.clearTimeout(animationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state.result || state.result.claimId === handledClaimId.current || pending) {
      return;
    }

    const timer = window.setTimeout(() => {
      const resultWheel = data.wheels.find((wheel) => wheel.id === state.result?.wheelId);

      if (!state.result || !resultWheel) {
        return;
      }

      const slices = wheelSlices(resultWheel);
      const nextRotation = calculateWinningRotation(wheelRotation, slices, state.result.segmentId);

      handledClaimId.current = state.result.claimId;
      setSelectedWheelId(resultWheel.id);
      setToastOpen(false);
      setLandedResult(null);
      setIsLanding(true);
      setWheelRotation(nextRotation);

      if (animationTimer.current) {
        window.clearTimeout(animationTimer.current);
      }

      animationTimer.current = window.setTimeout(() => {
        setIsLanding(false);
        setLandedResult(state.result);
        setToastOpen(true);
      }, minimumSpinMs);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [data.wheels, pending, state.result, wheelRotation]);

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
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(320px,720px)_minmax(280px,360px)] lg:p-5">
        <form
          action={formAction}
          className="bc-giveaway-wheel-card"
          onSubmit={() => {
            setSelectedWheelId(selectedWheel.id);
            setToastOpen(false);
            setLandedResult(null);
          }}
        >
          <input name="wheelId" type="hidden" value={selectedWheel.id} />
          <div className="bc-giveaway-stage">
            <div className="bc-giveaway-pointer" aria-hidden="true" />
            <div className="bc-giveaway-rim" aria-hidden="true" />
            <div className="bc-giveaway-bulbs" aria-hidden="true">
              {bulbIndexes.map((bulb) => (
                <span key={bulb} style={{ "--bc-bulb-angle": `${bulb * 9}deg` } as CSSProperties} />
              ))}
            </div>

            <div
              aria-label={`${selectedWheel.name} weighted prize wheel`}
              className={`bc-giveaway-wheel ${isLanding ? "bc-giveaway-wheel-landing" : ""}`}
              role="img"
              style={wheelStyle(selectedSlices, wheelRotation)}
            >
              {selectedSlices.map((slice) => {
                const SegmentIcon = prizeIconForType(slice.prizeType);

                return (
                  <div className="bc-giveaway-slice-content" key={slice.id} style={labelStyle(slice)}>
                    <SegmentIcon className="bc-giveaway-slice-icon" aria-hidden="true" />
                    <span className="bc-giveaway-slice-label">{twoLineLabel(slice.label)}</span>
                  </div>
                );
              })}
            </div>

            <button
              aria-label="Spin the reward wheel"
              className="bc-giveaway-center-button"
              disabled={isBusy || !selectedWheel.canSpin}
              type="submit"
            >
              <span className="bc-giveaway-center-text">
                SPIN
                <small>TO WIN</small>
              </span>
            </button>
          </div>
        </form>

        <aside className="bc-giveaway-result-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="acid">Rewards wheel</Badge>
              <h3 className="mt-3 text-2xl font-black">{selectedWheel.name}</h3>
            </div>
            <div className="rounded-md border border-bc-acid/30 bg-bc-acid/10 px-3 py-2 text-right">
              <p className="text-xs font-semibold uppercase text-bc-muted">Wallet</p>
              <p className="text-xl font-black text-bc-acid">{data.walletBalance.toLocaleString("en-GB")}</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-bc-muted">{selectedWheel.description ?? "Click the middle button to spin. The wheel slows down and stops on the saved result."}</p>

          {data.wheels.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.wheels.map((wheel) => (
                <button
                  className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                    wheel.id === selectedWheel.id
                      ? "border-bc-acid bg-bc-acid/15 text-bc-acid"
                      : "border-bc-line bg-white/5 text-bc-muted hover:border-bc-electric/60 hover:text-white"
                  }`}
                  disabled={isBusy}
                  key={wheel.id}
                  onClick={() => setSelectedWheelId(wheel.id)}
                  type="button"
                >
                  {wheel.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="bc-giveaway-result-box mt-5">
            <div>
              <div className="bc-giveaway-result-title">{resultTitle}</div>
              <div className="bc-giveaway-result-sub">{resultSubtitle}</div>
            </div>
          </div>

          <form
            action={formAction}
            onSubmit={() => {
              setSelectedWheelId(selectedWheel.id);
              setToastOpen(false);
              setLandedResult(null);
            }}
          >
            <input name="wheelId" type="hidden" value={selectedWheel.id} />
            <button className="bc-giveaway-spin-again" disabled={isBusy || !selectedWheel.canSpin} type="submit">
              {isBusy ? "Spinning..." : currentResult ? "Spin again" : "Spin wheel"}
            </button>
          </form>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md border border-bc-line bg-white/5 p-2">
              <p className="text-bc-muted">Cost</p>
              <p className="mt-1 font-black">{selectedWheel.costStars > 0 ? `${selectedWheel.costStars} stars` : "Free"}</p>
            </div>
            <div className="rounded-md border border-bc-line bg-white/5 p-2">
              <p className="text-bc-muted">Cooldown</p>
              <p className="mt-1 font-black">{selectedWheel.cooldownMinutes}m</p>
            </div>
            <div className="rounded-md border border-bc-line bg-white/5 p-2">
              <p className="text-bc-muted">State</p>
              <p className={selectedWheel.canSpin ? "mt-1 font-black text-bc-acid" : "mt-1 font-black text-bc-amber"}>
                {selectedWheel.canSpin ? "Ready" : "Locked"}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-4 border-t border-bc-line p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
        <section className="rounded-md border border-bc-line bg-bc-ink p-4">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h4 className="font-black">Prize slices</h4>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {selectedSlices.map((slice) => (
              <div
                className={`bc-reward-payline flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                  currentResult?.segmentId === slice.id ? "border-bc-acid bg-bc-acid/10" : "border-bc-line bg-bc-panel"
                }`}
                key={slice.id}
                style={{ "--bc-reward-segment-color": slice.color } as CSSProperties}
              >
                <div className="min-w-0">
                  <p className="truncate font-black">{slice.label}</p>
                  <p className="text-xs text-bc-muted">{slice.weight} weight</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={prizeTone(slice.prizeType)}>{slice.prizeType}</Badge>
                  <span className="text-xs font-black text-bc-acid">{slice.oddsPercent}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-md border border-bc-line bg-bc-ink p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h4 className="font-black">Recent spins</h4>
          </div>
          <p className="mt-2 text-sm text-bc-muted">{recentClaimsLabel} in your account.</p>
          <div className="mt-4 grid max-h-[360px] gap-3 overflow-y-auto pr-1">
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

      <div className={`bc-giveaway-toast-overlay ${toastOpen && currentResult ? "show" : ""}`} role="dialog" aria-live="polite" aria-modal="true">
        <div className="bc-giveaway-winner-toast">
          <Sparkles className="mx-auto h-16 w-16 text-bc-acid" aria-hidden="true" />
          <h2 className="bc-giveaway-toast-title">{currentResult?.segmentLabel ?? "Winner"}</h2>
          <p className="bc-giveaway-toast-subtitle">{currentResult?.message ?? "Result saved."}</p>
          <button className="bc-giveaway-toast-close" onClick={() => setToastOpen(false)} type="button">
            Close
          </button>
        </div>
      </div>
    </section>
  );
}
