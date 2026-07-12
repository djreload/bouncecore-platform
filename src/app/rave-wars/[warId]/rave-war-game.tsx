"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Crosshair, Flag, HeartPulse, Radio, Swords, Timer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RaveWarLastShot, RaveWarPlayerState, RaveWarShotPoint, RaveWarSummary, RaveWarWeaponId } from "@/lib/rave-wars/rave-war-types";

type RaveWarGameProps = {
  currentUserId: string;
  initialWar: RaveWarSummary;
};

type WarPayload = {
  error?: string;
  war?: RaveWarSummary;
};

type RaveWarAnimatedShot = {
  key: string;
  point: RaveWarShotPoint;
  trail: RaveWarShotPoint[];
};

type RaveWarImpactPulse = {
  damage: number;
  impactKind: RaveWarLastShot["impactKind"];
  key: string;
  point: RaveWarShotPoint;
};

type RaveWarSfx = "blocked" | "fire" | "hit" | "impact" | "miss";

const shotAnimationMinMs = 700;
const shotAnimationMaxMs = 1350;
const raveWarAssets = {
  explosion: "/rave-wars/assets/big-explosion.png",
  hedgehog: "/rave-wars/assets/hedgehog.png",
  hedgehogIdle: "/rave-wars/assets/hedgehog-idle.png",
  hedgehogBazooka: "/rave-wars/assets/hedgehog-bazooka.png",
  shell: "/rave-wars/assets/bazooka-shell.png",
  weaponGrenade: "/rave-wars/assets/weapon-grenade.png",
  weaponShotgun: "/rave-wars/assets/weapon-shotgun.png"
} as const;

const raveWarWeapons: Array<{
  description: string;
  icon: string;
  id: RaveWarWeaponId;
  label: string;
  projectile: string;
}> = [
  {
    description: "Classic long arc, big terrain crater.",
    icon: raveWarAssets.hedgehogBazooka,
    id: "bazooka",
    label: "Bazooka",
    projectile: raveWarAssets.shell
  },
  {
    description: "Heavier drop with a chunky blast.",
    icon: raveWarAssets.weaponGrenade,
    id: "grenade",
    label: "Grenade",
    projectile: raveWarAssets.weaponGrenade
  },
  {
    description: "Fast direct shot, smaller crater.",
    icon: raveWarAssets.weaponShotgun,
    id: "shotgun",
    label: "Shotgun",
    projectile: raveWarAssets.weaponShotgun
  }
];

const raveWarWeaponsById = new Map(raveWarWeapons.map((weapon) => [weapon.id, weapon]));

let raveWarAudioContext: AudioContext | null = null;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percent(value: number, max: number) {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

function formatStatus(status: string) {
  return status.replace(/-/g, " ").toUpperCase();
}

function healthTone(health: number) {
  if (health > 65) {
    return "bg-bc-acid";
  }

  if (health > 25) {
    return "bg-bc-amber";
  }

  return "bg-bc-pink";
}

function shotKey(shot: RaveWarLastShot | null | undefined) {
  return shot
    ? `${shot.firedAt}:${shot.weaponId}:${shot.shooterUserId}:${shot.targetUserId}:${shot.impactPoint.x}:${shot.impactPoint.y}:${shot.damage}`
    : null;
}

function levelPointFromPointer(
  event: PointerEvent<HTMLDivElement>,
  element: HTMLDivElement,
  level: RaveWarSummary["level"]
): RaveWarShotPoint {
  const rect = element.getBoundingClientRect();
  const relativeX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  const relativeY = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;

  return {
    x: Math.round(clampNumber(relativeX, 0, 1) * level.width),
    y: Math.round(clampNumber(relativeY, 0, 1) * level.height)
  };
}

function aimSettingsFromLevelPoint(player: RaveWarPlayerState, point: RaveWarShotPoint, level: RaveWarSummary["level"]) {
  const facing: RaveWarPlayerState["facing"] = point.x < player.x ? "left" : "right";
  const muzzleY = player.y - 34;
  const facingX = Math.abs(point.x - player.x);
  const vertical = muzzleY - point.y;
  const angle = clampNumber((Math.atan2(Math.max(0, vertical), Math.max(12, facingX)) * 180) / Math.PI, 0, 90);
  const distance = Math.hypot(facingX, vertical);
  const powerScale = level.width / 130;
  const power = clampNumber(distance / powerScale, 10, 100);

  return {
    angle: Math.round(angle),
    facing,
    power: Math.round(power)
  };
}

function aimPreviewFromPlayer(player: RaveWarPlayerState, angle: number, power: number) {
  const radians = (angle * Math.PI) / 180;
  const direction = player.facing === "left" ? -1 : 1;
  const muzzleX = player.x + 28 * direction;
  const muzzleY = player.y - 38;
  const length = 110 + power * 4.4;

  return {
    endX: muzzleX + Math.cos(radians) * length * direction,
    endY: muzzleY - Math.sin(radians) * length,
    muzzleX,
    muzzleY
  };
}

function projectileRotationFromTrail(trail: RaveWarShotPoint[]) {
  const latest = trail[trail.length - 1];
  const previous = trail[trail.length - 3] ?? trail[trail.length - 2];

  if (!latest || !previous) {
    return 0;
  }

  return (Math.atan2(latest.y - previous.y, latest.x - previous.x) * 180) / Math.PI;
}

function getRaveWarAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  raveWarAudioContext ??= new AudioContextCtor();

  if (raveWarAudioContext.state === "suspended") {
    void raveWarAudioContext.resume().catch(() => undefined);
  }

  return raveWarAudioContext;
}

function scheduleTone(input: {
  context: AudioContext;
  duration: number;
  endFrequency?: number;
  frequency: number;
  gain: number;
  startAt: number;
  type: OscillatorType;
}) {
  const oscillator = input.context.createOscillator();
  const gain = input.context.createGain();
  const endFrequency = input.endFrequency ?? input.frequency;
  const endAt = input.startAt + input.duration;

  oscillator.type = input.type;
  oscillator.frequency.setValueAtTime(input.frequency, input.startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
  gain.gain.setValueAtTime(0.0001, input.startAt);
  gain.gain.exponentialRampToValueAtTime(input.gain, input.startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  oscillator.connect(gain);
  gain.connect(input.context.destination);
  oscillator.start(input.startAt);
  oscillator.stop(endAt + 0.02);
}

function scheduleNoiseBurst(input: { context: AudioContext; duration: number; frequency: number; gain: number; startAt: number }) {
  const frameCount = Math.max(1, Math.floor(input.context.sampleRate * input.duration));
  const buffer = input.context.createBuffer(1, frameCount, input.context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    const fade = 1 - index / frameCount;

    channel[index] = (Math.random() * 2 - 1) * fade;
  }

  const source = input.context.createBufferSource();
  const filter = input.context.createBiquadFilter();
  const gain = input.context.createGain();
  const endAt = input.startAt + input.duration;

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(input.frequency, input.startAt);
  filter.Q.setValueAtTime(0.8, input.startAt);
  gain.gain.setValueAtTime(input.gain, input.startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(input.context.destination);
  source.start(input.startAt);
  source.stop(endAt + 0.02);
}

function playRaveWarSfx(kind: RaveWarSfx) {
  const context = getRaveWarAudioContext();

  if (!context) {
    return;
  }

  const now = context.currentTime + 0.015;

  if (kind === "fire") {
    scheduleTone({ context, duration: 0.22, endFrequency: 90, frequency: 360, gain: 0.08, startAt: now, type: "sawtooth" });
    scheduleNoiseBurst({ context, duration: 0.18, frequency: 1550, gain: 0.045, startAt: now });
    return;
  }

  if (kind === "hit") {
    scheduleTone({ context, duration: 0.22, endFrequency: 46, frequency: 120, gain: 0.1, startAt: now, type: "sine" });
    scheduleTone({ context, duration: 0.16, endFrequency: 760, frequency: 540, gain: 0.045, startAt: now + 0.04, type: "square" });
    scheduleNoiseBurst({ context, duration: 0.24, frequency: 420, gain: 0.075, startAt: now });
    return;
  }

  if (kind === "impact") {
    scheduleTone({ context, duration: 0.24, endFrequency: 38, frequency: 96, gain: 0.09, startAt: now, type: "sine" });
    scheduleNoiseBurst({ context, duration: 0.28, frequency: 360, gain: 0.07, startAt: now });
    return;
  }

  if (kind === "miss") {
    scheduleTone({ context, duration: 0.24, endFrequency: 170, frequency: 480, gain: 0.045, startAt: now, type: "triangle" });
    return;
  }

  scheduleTone({ context, duration: 0.12, endFrequency: 130, frequency: 170, gain: 0.045, startAt: now, type: "square" });
}

function HedgehogFrame({ facing, isWalking }: { facing: RaveWarPlayerState["facing"]; isWalking: boolean }) {
  return (
    <span className="bc-rave-war-hog-shell" data-facing={facing}>
      <span
        className="bc-rave-war-hog-frame"
        data-walking={isWalking ? "true" : "false"}
        style={{
          backgroundImage: `url(${raveWarAssets.hedgehogIdle})`
        }}
      />
    </span>
  );
}

export function RaveWarGame({ currentUserId, initialWar }: RaveWarGameProps) {
  const [war, setWar] = useState(initialWar);
  const battlefieldRef = useRef<HTMLDivElement | null>(null);
  const latestAnimatedShotKeyRef = useRef<string | null>(shotKey(initialWar.state.lastShot));
  const impactPulseTimeoutRef = useRef<number | null>(null);
  const currentPlayer = war.state.players.find((player) => player.userId === currentUserId) ?? null;
  const activePlayer = war.state.players.find((player) => player.userId === war.turnUserId) ?? null;
  const opponent = war.state.players.find((player) => player.userId !== currentUserId) ?? null;
  const winner = war.winnerUserId ? war.state.players.find((player) => player.userId === war.winnerUserId) : null;
  const [angle, setAngle] = useState(currentPlayer?.angle ?? 80);
  const [power, setPower] = useState(currentPlayer?.power ?? 65);
  const [selectedWeapon, setSelectedWeapon] = useState<RaveWarWeaponId>(currentPlayer?.selectedWeapon ?? "bazooka");
  const [aimFacing, setAimFacing] = useState<RaveWarPlayerState["facing"]>(currentPlayer?.facing ?? "right");
  const [isAiming, setIsAiming] = useState(false);
  const [animatedShot, setAnimatedShot] = useState<RaveWarAnimatedShot | null>(null);
  const [impactPulse, setImpactPulse] = useState<RaveWarImpactPulse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const mapStyle = useMemo(
    () => ({
      backgroundColor: war.level.backgroundColor
    }),
    [war.level.backgroundColor]
  );
  const terrainMaskId = useMemo(() => `rave-war-terrain-mask-${war.id.replace(/[^a-zA-Z0-9_-]/g, "")}`, [war.id]);
  const canFire = war.status === "active" && war.turnUserId === currentUserId && !busy;
  const canAccept = war.status === "pending" && war.currentUserRole === "target";
  const currentShotKey = shotKey(war.state.lastShot);
  const visibleShotPath =
    animatedShot && animatedShot.key === currentShotKey ? animatedShot.trail : war.state.lastShot?.path ?? [];
  const currentAimPlayer = currentPlayer
    ? {
        ...currentPlayer,
        facing: aimFacing
      }
    : null;
  const aimPreview = currentAimPlayer ? aimPreviewFromPlayer(currentAimPlayer, angle, power) : null;
  const shellRotation = projectileRotationFromTrail(animatedShot?.trail ?? []);
  const lastBlastRadius = war.state.lastShot?.blastRadius ?? 150;
  const lastWeapon = raveWarWeaponsById.get(war.state.lastShot?.weaponId ?? "bazooka") ?? raveWarWeapons[0];
  const turnEndsAtMs = war.state.turnEndsAt ? Date.parse(war.state.turnEndsAt) : Number.NaN;
  const remainingTurnSeconds = Number.isFinite(turnEndsAtMs) ? Math.max(0, Math.ceil((turnEndsAtMs - nowMs) / 1000)) : null;

  const applyWar = useCallback((nextWar: RaveWarSummary) => {
    setWar(nextWar);
    setError(null);

    const nextCurrentPlayer = nextWar.state.players.find((player) => player.userId === currentUserId);

    if (nextCurrentPlayer) {
      setAngle(nextCurrentPlayer.angle);
      setAimFacing(nextCurrentPlayer.facing);
      setPower(nextCurrentPlayer.power);
      setSelectedWeapon(nextCurrentPlayer.selectedWeapon);
    }
  }, [currentUserId, setAimFacing, setAngle, setError, setPower, setSelectedWeapon, setWar]);

  const refreshWarFromPayload = useCallback((payload: WarPayload) => {
    if (payload.war) {
      applyWar(payload.war);
    } else if (payload.error) {
      setError(payload.error);
    }
  }, [applyWar, setError]);

  const postWarAction = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);

      try {
        const response = await fetch(`/api/rave-wars/${encodeURIComponent(war.id)}/actions`, {
          body: JSON.stringify({
            action,
            ...body
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const payload = (await response.json()) as WarPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Rave War action failed.");
        }

        refreshWarFromPayload(payload);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Rave War action failed.");
        if (action === "fire") {
          playRaveWarSfx("blocked");
        }
      } finally {
        setBusy(false);
      }
    },
    [refreshWarFromPayload, setBusy, setError, war.id]
  );

  const postChallengeAction = useCallback(
    async (action: "accept" | "decline") => {
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/rave-wars/challenges", {
          body: JSON.stringify({
            action,
            warId: war.id
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });
        const payload = (await response.json()) as WarPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Rave War challenge action failed.");
        }

        refreshWarFromPayload(payload);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Rave War challenge action failed.");
      } finally {
        setBusy(false);
      }
    },
    [refreshWarFromPayload, setBusy, setError, war.id]
  );

  const updateAimFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const element = battlefieldRef.current;

      if (!element || !currentPlayer || !canFire) {
        return;
      }

      const nextAim = aimSettingsFromLevelPoint(currentPlayer, levelPointFromPointer(event, element, war.level), war.level);

      setAngle(nextAim.angle);
      setAimFacing(nextAim.facing);
      setPower(nextAim.power);
    },
    [canFire, currentPlayer, setAimFacing, setAngle, setPower, war.level]
  );

  const handleBattlefieldPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canFire) {
        return;
      }

      setIsAiming(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      updateAimFromPointer(event);
    },
    [canFire, setIsAiming, updateAimFromPointer]
  );

  const handleBattlefieldPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canFire) {
        return;
      }

      if (event.pointerType === "mouse" || isAiming) {
        updateAimFromPointer(event);
      }
    },
    [canFire, isAiming, updateAimFromPointer]
  );

  const handleBattlefieldPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setIsAiming(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [setIsAiming]);

  const fireCurrentShot = useCallback(async () => {
    if (!canFire) {
      playRaveWarSfx("blocked");
      return;
    }

    playRaveWarSfx("fire");
    await postWarAction("fire", { angle, facing: aimFacing, power, weaponId: selectedWeapon });
  }, [aimFacing, angle, canFire, postWarAction, power, selectedWeapon]);

  const moveCurrentPlayer = useCallback(
    async (direction: "left" | "right") => {
      if (!canFire) {
        playRaveWarSfx("blocked");
        return;
      }

      setAimFacing(direction);
      await postWarAction("move", { direction });
    },
    [canFire, postWarAction, setAimFacing]
  );

  const handleBattlefieldKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!canFire) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        void moveCurrentPlayer("left");
        return;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        void moveCurrentPlayer("right");
        return;
      }

      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        setAngle((current) => clampNumber(current + 2, 0, 90));
        return;
      }

      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        setAngle((current) => clampNumber(current - 2, 0, 90));
        return;
      }

      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        setPower((current) => clampNumber(current + 3, 10, 100));
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setPower((current) => clampNumber(current - 3, 10, 100));
        return;
      }

      if (event.key.toLowerCase() === "q" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        setSelectedWeapon((current) => {
          const currentIndex = raveWarWeapons.findIndex((weapon) => weapon.id === current);
          const nextIndex =
            event.key.toLowerCase() === "q"
              ? (currentIndex - 1 + raveWarWeapons.length) % raveWarWeapons.length
              : (currentIndex + 1) % raveWarWeapons.length;

          return raveWarWeapons[nextIndex]?.id ?? "bazooka";
        });
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        void fireCurrentShot();
      }
    },
    [canFire, fireCurrentShot, moveCurrentPlayer, setAngle, setPower, setSelectedWeapon]
  );

  useEffect(() => {
    if (war.status !== "active") {
      return undefined;
    }

    const interval = window.setInterval(() => setNowMs(Date.now()), 500);

    return () => window.clearInterval(interval);
  }, [war.status]);

  useEffect(() => {
    let active = true;
    let fallbackInterval: number | null = null;
    let eventSource: EventSource | null = null;

    async function refreshWar() {
      try {
        const response = await fetch(`/api/rave-wars/${encodeURIComponent(war.id)}/stream`, {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }
      } catch {
        // The EventSource path handles live updates; fetch fallback is only a liveness nudge.
      }
    }

    function startPollingFallback() {
      if (fallbackInterval !== null) {
        return;
      }

      fallbackInterval = window.setInterval(() => {
        window.location.reload();
      }, 10000);
    }

    if ("EventSource" in window) {
      eventSource = new EventSource(`/api/rave-wars/${encodeURIComponent(war.id)}/stream`);

      eventSource.addEventListener("war", (event) => {
        if (!active) {
          return;
        }

        try {
          refreshWarFromPayload(JSON.parse((event as MessageEvent<string>).data) as WarPayload);
        } catch {
          // Ignore malformed stream events.
        }
      });

      eventSource.onerror = () => {
        if (!active) {
          return;
        }

        eventSource?.close();
        eventSource = null;
        startPollingFallback();
      };
    } else {
      void refreshWar();
      startPollingFallback();
    }

    return () => {
      active = false;
      eventSource?.close();

      if (fallbackInterval !== null) {
        window.clearInterval(fallbackInterval);
      }
    };
  }, [refreshWarFromPayload, war.id]);

  useEffect(() => {
    const lastShot = war.state.lastShot;
    const nextShotKey = shotKey(lastShot);

    if (!lastShot || !nextShotKey || latestAnimatedShotKeyRef.current === nextShotKey) {
      return undefined;
    }

    const animationKey = nextShotKey;
    const shot = lastShot;

    latestAnimatedShotKeyRef.current = animationKey;

    if (impactPulseTimeoutRef.current !== null) {
      window.clearTimeout(impactPulseTimeoutRef.current);
      impactPulseTimeoutRef.current = null;
    }

    const path = [...shot.path, shot.impactPoint];
    const duration = clampNumber(path.length * 18, shotAnimationMinMs, shotAnimationMaxMs);
    const startedAt = window.performance.now();
    let animationFrame = 0;

    if (shot.shooterUserId !== currentUserId) {
      playRaveWarSfx("fire");
    }

    setImpactPulse(null);

    function tick(now: number) {
      const progress = clampNumber((now - startedAt) / duration, 0, 1);
      const index = Math.min(path.length - 1, Math.floor(progress * (path.length - 1)));

      setAnimatedShot({
        key: animationKey,
        point: path[index] ?? shot.impactPoint,
        trail: path.slice(0, index + 1)
      });

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      setAnimatedShot(null);
      setImpactPulse({
        damage: shot.damage,
        impactKind: shot.impactKind,
        key: animationKey,
        point: shot.impactPoint
      });
      playRaveWarSfx(shot.damage > 0 ? "hit" : shot.impactKind === "out-of-bounds" ? "miss" : "impact");

      impactPulseTimeoutRef.current = window.setTimeout(() => {
        setImpactPulse((current) => (current?.key === animationKey ? null : current));
        impactPulseTimeoutRef.current = null;
      }, 900);
    }

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [currentUserId, war.state.lastShot]);

  useEffect(
    () => () => {
      if (impactPulseTimeoutRef.current !== null) {
        window.clearTimeout(impactPulseTimeoutRef.current);
      }
    },
    []
  );

  return (
    <section className="mx-auto flex h-full min-h-[calc(100dvh-97px)] w-full max-w-[1680px] flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-panel p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/45 bg-bc-electric/10 text-bc-electric">
            <Swords className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={war.status === "active" ? "acid" : war.status === "finished" ? "pink" : "cyan"}>{formatStatus(war.status)}</Badge>
              <Badge tone="muted">#{war.roomSlug}</Badge>
            </div>
            <h1 className="mt-1 truncate text-xl font-black">{war.level.name}</h1>
          </div>
        </div>
        <Link className="bc-focus-ring rounded-md border border-bc-line px-3 py-2 text-sm font-semibold text-white transition hover:border-bc-electric/60" href="/live">
          Back to live
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 rounded-md border border-bc-line bg-bc-panel p-2">
          <div
            aria-label="Rave War battlefield. Move the mouse or drag on the map to aim. Use left and right or A and D to walk. Use up and down or W and S to aim. Use plus and minus for power. Press Q and E for weapons. Double click the map, press Enter, or press Space to shoot."
            className={`relative mx-auto aspect-[2/1] max-h-[calc(100dvh-190px)] min-h-[260px] overflow-hidden rounded-md border border-bc-line bg-cover bg-center ${
              canFire ? "cursor-crosshair touch-none" : "cursor-default"
            }`}
            onDoubleClick={() => void fireCurrentShot()}
            onKeyDown={handleBattlefieldKeyDown}
            onPointerCancel={handleBattlefieldPointerUp}
            onPointerDown={handleBattlefieldPointerDown}
            onPointerLeave={() => setIsAiming(false)}
            onPointerMove={handleBattlefieldPointerMove}
            onPointerUp={handleBattlefieldPointerUp}
            ref={battlefieldRef}
            role="application"
            style={mapStyle}
            tabIndex={canFire ? 0 : -1}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${war.level.width} ${war.level.height}`} aria-hidden="true">
              <defs>
                <mask id={terrainMaskId}>
                  <rect fill="#ffffff" height={war.level.height} width={war.level.width} x="0" y="0" />
                  {war.state.craters.map((crater, index) => (
                    <circle cx={crater.x} cy={crater.y} fill="#000000" key={`${crater.x}-${crater.y}-${crater.radius}-mask-${index}`} r={crater.radius} />
                  ))}
                </mask>
                <radialGradient id="rave-war-crater-rim-gradient">
                  <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="68%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="82%" stopColor="rgba(0,0,0,0.58)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
                </radialGradient>
              </defs>
              <image height={war.level.height} href={war.level.mapImageUrl} mask={`url(#${terrainMaskId})`} preserveAspectRatio="none" width={war.level.width} x="0" y="0" />
              {war.state.craters.map((crater, index) => (
                <g key={`${crater.x}-${crater.y}-${crater.radius}-${index}`}>
                  <circle cx={crater.x} cy={crater.y} fill="url(#rave-war-crater-rim-gradient)" r={crater.radius + 9} />
                  <circle cx={crater.x} cy={crater.y} fill="none" r={Math.max(16, crater.radius - 6)} stroke="rgba(0,0,0,0.62)" strokeWidth="7" />
                </g>
              ))}
              {visibleShotPath.length ? (
                <polyline
                  fill="none"
                  points={visibleShotPath.map((point) => `${point.x},${point.y}`).join(" ")}
                  stroke="#a3ff12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="8"
                />
              ) : null}
              {aimPreview && war.status === "active" ? (
                <>
                  <line
                    stroke={canFire ? "#00d5ff" : "rgba(163,255,18,0.28)"}
                    strokeDasharray="22 16"
                    strokeLinecap="round"
                    strokeWidth="7"
                    x1={aimPreview.muzzleX}
                    x2={aimPreview.endX}
                    y1={aimPreview.muzzleY}
                    y2={aimPreview.endY}
                  />
                  <circle cx={aimPreview.endX} cy={aimPreview.endY} fill="rgba(0,213,255,0.18)" r={Math.max(34, power)} stroke="#00d5ff" strokeWidth="5" />
                </>
              ) : null}
              {war.state.lastShot && !animatedShot ? (
                <>
                  <circle
                    cx={war.state.lastShot.impactPoint.x}
                    cy={war.state.lastShot.impactPoint.y}
                    fill="rgba(255,63,164,0.32)"
                    r="54"
                    stroke="#ff3fa4"
                    strokeWidth="8"
                  />
                  <circle cx={war.state.lastShot.impactPoint.x} cy={war.state.lastShot.impactPoint.y} fill="#ffffff" r="10" />
                </>
              ) : null}
              {animatedShot ? (
                <>
                  <circle cx={animatedShot.point.x} cy={animatedShot.point.y} fill="rgba(163,255,18,0.35)" r="34" />
                  <image
                    height="54"
                    href={lastWeapon.projectile}
                    transform={`rotate(${shellRotation} ${animatedShot.point.x} ${animatedShot.point.y})`}
                    width="54"
                    x={animatedShot.point.x - 27}
                    y={animatedShot.point.y - 27}
                  />
                </>
              ) : null}
              {impactPulse ? (
                <>
                  <image
                    className="animate-pulse"
                    height={lastBlastRadius * 2.15}
                    href={raveWarAssets.explosion}
                    opacity="0.94"
                    width={lastBlastRadius * 2.15}
                    x={impactPulse.point.x - lastBlastRadius * 1.075}
                    y={impactPulse.point.y - lastBlastRadius * 1.075}
                  />
                  <circle
                    className="animate-ping"
                    cx={impactPulse.point.x}
                    cy={impactPulse.point.y}
                    fill={impactPulse.damage > 0 ? "rgba(255,63,164,0.35)" : "rgba(0,213,255,0.24)"}
                    r={lastBlastRadius}
                  />
                  <text
                    fill={impactPulse.damage > 0 ? "#ff3fa4" : "#00d5ff"}
                    fontSize="58"
                    fontWeight="900"
                    stroke="#05070d"
                    strokeWidth="8"
                    textAnchor="middle"
                    x={impactPulse.point.x}
                    y={Math.max(72, impactPulse.point.y - 70)}
                  >
                    {impactPulse.damage > 0 ? `-${impactPulse.damage}` : impactPulse.impactKind === "out-of-bounds" ? "MISS" : "BOOM"}
                  </text>
                  <text
                    fill={impactPulse.damage > 0 ? "#ff3fa4" : "#00d5ff"}
                    fontSize="58"
                    fontWeight="900"
                    textAnchor="middle"
                    x={impactPulse.point.x}
                    y={Math.max(72, impactPulse.point.y - 70)}
                  >
                    {impactPulse.damage > 0 ? `-${impactPulse.damage}` : impactPulse.impactKind === "out-of-bounds" ? "MISS" : "BOOM"}
                  </text>
                </>
              ) : null}
            </svg>

            {war.state.players.map((player) => {
              const isActivePlayer = war.turnUserId === player.userId;
              const displayFacing = player.userId === currentUserId ? aimFacing : player.facing;
              const playerWeapon = raveWarWeaponsById.get(player.userId === currentUserId ? selectedWeapon : player.selectedWeapon) ?? raveWarWeapons[0];

              return (
                <div
                  className="absolute -translate-x-1/2 -translate-y-full transition-[left,top] duration-200 ease-out"
                  key={player.userId}
                  style={{
                    left: percent(player.x, war.level.width),
                    top: percent(player.y, war.level.height)
                  }}
                >
                  <div className="relative h-20 w-20" title={player.displayName}>
                    <div
                      className={`absolute inset-x-2 bottom-1 h-3 rounded-full blur-md ${
                        isActivePlayer ? "bg-bc-acid/45" : "bg-black/55"
                      }`}
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                      <HedgehogFrame facing={displayFacing} isWalking={isActivePlayer && war.status === "active"} />
                    </div>
                    {isActivePlayer ? (
                      <Image
                        alt=""
                        className="absolute bottom-8 left-1/2 h-10 w-10 -translate-x-1/2 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                        draggable={false}
                        height={40}
                        src={playerWeapon.icon}
                        style={{
                          transform: `translateX(-50%) scaleX(${displayFacing === "left" ? -1 : 1}) rotate(${displayFacing === "left" ? -angle : angle}deg)`,
                          transformOrigin: displayFacing === "left" ? "42% 54%" : "58% 54%"
                        }}
                        unoptimized
                        width={40}
                      />
                    ) : null}
                    <div
                      className="absolute bottom-0 left-1/2 h-1.5 w-16 -translate-x-1/2 overflow-hidden rounded-full border border-black/60 bg-black/70"
                      style={{ boxShadow: `0 0 0 1px ${player.color}` }}
                    >
                      <div className={healthTone(player.health)} style={{ height: "100%", width: `${player.health}%` }} />
                    </div>
                    <div
                      className="absolute -top-1 left-1/2 max-w-28 -translate-x-1/2 truncate rounded-full border bg-black/65 px-2 py-0.5 text-center text-[10px] font-black text-white backdrop-blur-sm"
                      style={{ borderColor: player.color }}
                    >
                      {player.displayName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="grid content-start gap-3">
          <section className="rounded-md border border-bc-line bg-bc-panel p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black uppercase">Players</h2>
              <Badge tone="muted">Turn {war.state.turnNumber}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              {war.state.players.map((player) => {
                const playerWeapon = raveWarWeaponsById.get(player.userId === currentUserId ? selectedWeapon : player.selectedWeapon) ?? raveWarWeapons[0];

                return (
                  <article className="rounded-md border border-bc-line bg-bc-ink p-2" key={player.userId}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{player.displayName}</p>
                        <p className="mt-1 text-xs text-bc-muted">{player.userId === currentUserId ? "You" : "Opponent"}</p>
                      </div>
                      <Badge tone={war.turnUserId === player.userId ? "acid" : "muted"}>{war.turnUserId === player.userId ? "Turn" : "Ready"}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bc-panel">
                        <div className={healthTone(player.health)} style={{ height: "100%", width: `${player.health}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-black">{player.health}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-bc-muted">
                      <span>{playerWeapon.label}</span>
                      <span>{Math.round(player.movementLeft)} move</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-bc-line bg-bc-panel p-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase">Weapons</h2>
            </div>

            {war.status === "pending" ? (
              <div className="mt-3 grid gap-2">
                <p className="text-sm text-bc-muted">
                  {canAccept ? `${opponent?.displayName ?? "Someone"} is waiting.` : `Waiting for ${opponent?.displayName ?? "the opponent"}.`}
                </p>
                {canAccept ? (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => void postChallengeAction("accept")} size="sm" type="button">
                      Accept
                    </Button>
                    <Button disabled={busy} onClick={() => void postChallengeAction("decline")} size="sm" type="button" variant="ghost">
                      Decline
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {war.status === "active" ? (
              <div className="mt-3 grid gap-3">
                <div className="rounded-md border border-bc-line bg-bc-ink p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Timer className="h-4 w-4 shrink-0 text-bc-amber" aria-hidden="true" />
                      <span className="truncate font-semibold">{activePlayer ? `${activePlayer.displayName}'s turn` : "Turn changing"}</span>
                    </div>
                    <Badge tone={remainingTurnSeconds !== null && remainingTurnSeconds <= 10 ? "pink" : "amber"}>
                      {remainingTurnSeconds !== null ? `${remainingTurnSeconds}s` : "--"}
                    </Badge>
                  </div>
                  {canFire ? (
                    <p className="mt-2 text-xs text-bc-muted">
                      Mouse/drag aims. Left/right or A/D walks. Up/down or W/S aims. +/- power. Q/E weapons. Space, Enter, double click, or Fire shoots.
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="bc-focus-ring min-h-9 rounded-md border border-bc-line bg-bc-ink px-3 text-xs font-black text-white transition hover:border-bc-electric/60 disabled:opacity-50"
                    disabled={!canFire || !currentPlayer?.movementLeft}
                    onClick={() => void moveCurrentPlayer("left")}
                    type="button"
                  >
                    Walk left
                  </button>
                  <button
                    className="bc-focus-ring min-h-9 rounded-md border border-bc-line bg-bc-ink px-3 text-xs font-black text-white transition hover:border-bc-electric/60 disabled:opacity-50"
                    disabled={!canFire || !currentPlayer?.movementLeft}
                    onClick={() => void moveCurrentPlayer("right")}
                    type="button"
                  >
                    Walk right
                  </button>
                </div>
                <div className="grid gap-2 rounded-md border border-bc-line bg-bc-ink p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase text-bc-muted">Movement</p>
                    <span className="text-xs font-black text-bc-acid">{currentPlayer ? Math.round(currentPlayer.movementLeft) : 0}px</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bc-panel">
                    <div className="h-full bg-bc-acid" style={{ width: percent(currentPlayer?.movementLeft ?? 0, 220) }} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-[10px] font-black uppercase text-bc-muted">Weapon</p>
                  <div className="grid grid-cols-3 gap-2">
                    {raveWarWeapons.map((weapon) => (
                      <button
                        className={`bc-focus-ring grid min-h-16 place-items-center rounded-md border px-2 py-2 text-center text-[11px] font-black transition ${
                          selectedWeapon === weapon.id
                            ? "border-bc-electric bg-bc-electric/15 text-white"
                            : "border-bc-line bg-bc-ink text-bc-muted hover:border-bc-electric/50 hover:text-white"
                        }`}
                        disabled={!canFire}
                        key={weapon.id}
                        onClick={() => setSelectedWeapon(weapon.id)}
                        title={weapon.description}
                        type="button"
                      >
                        <Image alt="" className="h-7 w-7 object-contain" height={28} src={weapon.icon} unoptimized width={28} />
                        <span>{weapon.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-bc-line bg-bc-ink p-2">
                    <p className="text-[10px] font-black uppercase text-bc-muted">Angle</p>
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setAngle((current) => clampNumber(current - 2, 0, 90))}
                        type="button"
                      >
                        -2
                      </button>
                      <span className="min-w-10 text-center text-sm font-black text-bc-electric">{Math.round(angle)} deg</span>
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setAngle((current) => clampNumber(current + 2, 0, 90))}
                        type="button"
                      >
                        +2
                      </button>
                    </div>
                  </div>
                  <div className="rounded-md border border-bc-line bg-bc-ink p-2">
                    <p className="text-[10px] font-black uppercase text-bc-muted">Power</p>
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setPower((current) => clampNumber(current - 3, 10, 100))}
                        type="button"
                      >
                        -3
                      </button>
                      <span className="min-w-10 text-center text-sm font-black text-bc-pink">{Math.round(power)}%</span>
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setPower((current) => clampNumber(current + 3, 10, 100))}
                        type="button"
                      >
                        +3
                      </button>
                    </div>
                  </div>
                </div>
                <label className="grid gap-1 text-xs font-black uppercase text-bc-muted">
                  Angle {Math.round(angle)}
                  <input
                    className="w-full accent-bc-electric"
                    disabled={!canFire}
                    max={90}
                    min={0}
                    onChange={(event) => setAngle(Number(event.target.value))}
                    type="range"
                    value={angle}
                  />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase text-bc-muted">
                  Power {Math.round(power)}
                  <input
                    className="w-full accent-bc-pink"
                    disabled={!canFire}
                    max={100}
                    min={10}
                    onChange={(event) => setPower(Number(event.target.value))}
                    type="range"
                    value={power}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!canFire} onClick={() => void fireCurrentShot()} size="sm" type="button">
                    <Crosshair className="h-4 w-4" aria-hidden="true" />
                    Fire
                  </Button>
                  <Button disabled={busy} onClick={() => void postWarAction("surrender")} size="sm" type="button" variant="ghost">
                    <Flag className="h-4 w-4" aria-hidden="true" />
                    Surrender
                  </Button>
                </div>
              </div>
            ) : null}

            {war.status === "finished" ? (
              <div className="mt-3 rounded-md border border-bc-pink/35 bg-bc-pink/10 p-3">
                <p className="text-sm font-black">{winner ? `${winner.displayName} wins` : "Rave War finished"}</p>
              </div>
            ) : null}

            {error ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-bc-pink/35 bg-bc-pink/10 p-2 text-sm text-bc-pink">
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-bc-line bg-bc-panel p-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-bc-acid" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase">Log</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {war.state.log.map((entry, index) => (
                <p className="rounded-md border border-bc-line bg-bc-ink px-2 py-1.5 text-xs text-bc-muted" key={`${entry}-${index}`}>
                  {entry}
                </p>
              ))}
              {war.state.lastShot ? (
                <p className="rounded-md border border-bc-electric/30 bg-bc-electric/10 px-2 py-1.5 text-xs font-semibold text-bc-electric">
                  Last impact: {war.state.lastShot.impactKind.replace(/-/g, " ")}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
