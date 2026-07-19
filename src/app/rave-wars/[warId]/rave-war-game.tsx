"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import { Crosshair, Flag, HeartPulse, Maximize2, Radio, Swords, Timer, X, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { simulateRaveWarShot } from "@/lib/rave-wars/rave-war-engine";
import type { RaveWarLastShot, RaveWarPlayerState, RaveWarShotPoint, RaveWarSummary, RaveWarWeaponId } from "@/lib/rave-wars/rave-war-types";
import { defaultRaveWarWeaponAmmo, raveWarWeaponDefinitions, weaponAmmoOrDefault, type RaveWarWeaponDefinition } from "@/lib/rave-wars/rave-war-weapons";

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
  weaponId: RaveWarWeaponId;
};

type RaveWarImpactPulse = {
  damage: number;
  impactKind: RaveWarLastShot["impactKind"];
  key: string;
  point: RaveWarShotPoint;
};

type RaveWarSfx = "blocked" | "fire" | "hit" | "impact" | "miss";
type RaveWarMoveDirection = "left" | "right";
type RaveWarNativeControl = "aim-down" | "aim-up" | "fire" | "left" | "right" | "weapon-next" | "weapon-prev" | "zoom-in" | "zoom-out";
type RaveWarNativeControlState = "down" | "press" | "up";

const chargeDurationMs = 1450;
const liveReturnDelayMs = 4500;
const aimHoldIntervalMs = 45;
const aimHoldStep = 1.35;
const moveHoldIntervalMs = 185;
const shotAnimationMinMs = 700;
const shotAnimationMaxMs = 1350;
const cameraFitZoom = 1.02;
const cameraMinZoom = 0.72;
const cameraMaxZoom = 1.8;
const cameraZoomStep = 0.18;
const terminalRaveWarStatuses = new Set(["cancelled", "declined", "expired", "finished"]);
const raveWarAssets = {
  explosion: "/rave-wars/assets/big-explosion.png",
  worms: ["/rave-wars/assets/rave-worm-pink.png", "/rave-wars/assets/rave-worm-lime.png"]
} as const;

const raveWarWeapons = raveWarWeaponDefinitions;
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

function formatCountdown(seconds: number | null) {
  if (seconds === null) {
    return "--";
  }

  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const trailingSeconds = safeSeconds % 60;

  return `${minutes}:${String(trailingSeconds).padStart(2, "0")}`;
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

function playerHudSide(playerIndex: number) {
  return playerIndex === 0 ? "left" : "right";
}

function shotKey(shot: RaveWarLastShot | null | undefined) {
  return shot
    ? `${shot.firedAt}:${shot.weaponId}:${shot.shooterUserId}:${shot.targetUserId}:${shot.impactPoint.x}:${shot.impactPoint.y}:${shot.damage}`
    : null;
}

function levelPointFromPointer(
  event: Pick<PointerEvent<HTMLDivElement> | WheelEvent<HTMLDivElement>, "clientX" | "clientY">,
  element: HTMLDivElement,
  level: RaveWarSummary["level"],
  cameraZoom = 1,
  cameraOrigin: RaveWarShotPoint = { x: level.width / 2, y: level.height / 2 }
): RaveWarShotPoint {
  const rect = element.getBoundingClientRect();
  const relativeX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  const relativeY = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
  const originX = cameraOrigin.x / level.width;
  const originY = cameraOrigin.y / level.height;
  const worldX = originX + (relativeX - originX) / cameraZoom;
  const worldY = originY + (relativeY - originY) / cameraZoom;

  return {
    x: Math.round(clampNumber(worldX, 0, 1) * level.width),
    y: Math.round(clampNumber(worldY, 0, 1) * level.height)
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

function stopBattlefieldControlEvent(event: PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

function ammoForWeapon(player: RaveWarPlayerState | null | undefined, weaponId: RaveWarWeaponId) {
  return player ? weaponAmmoOrDefault(player.weaponAmmo, weaponId) : defaultRaveWarWeaponAmmo[weaponId];
}

function gameInputShouldIgnoreTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;

  if (!element) {
    return false;
  }

  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
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

function RaveWormFrame({
  angle,
  facing,
  isWalking,
  playerIndex,
  showWeapon,
  weapon
}: {
  angle: number;
  facing: RaveWarPlayerState["facing"];
  isWalking: boolean;
  playerIndex: number;
  showWeapon: boolean;
  weapon: RaveWarWeaponDefinition;
}) {
  const wormUrl = raveWarAssets.worms[playerIndex % raveWarAssets.worms.length] ?? raveWarAssets.worms[0];

  return (
    <span className="bc-rave-war-worm-shell" data-facing={facing}>
      <Image
        alt=""
        className="bc-rave-war-worm-body"
        data-walking={isWalking ? "true" : "false"}
        draggable={false}
        height={96}
        src={wormUrl}
        unoptimized
        width={96}
      />
      {showWeapon ? (
        <Image
          alt=""
          className="bc-rave-war-worm-weapon"
          draggable={false}
          height={32}
          src={weapon.iconUrl}
          style={{
            transform: `rotate(${facing === "left" ? -angle : angle}deg)`
          }}
          unoptimized
          width={32}
        />
      ) : null}
    </span>
  );
}

export function RaveWarGame({ currentUserId, initialWar }: RaveWarGameProps) {
  const [war, setWar] = useState(initialWar);
  const battlefieldRef = useRef<HTMLDivElement | null>(null);
  const latestAnimatedShotKeyRef = useRef<string | null>(shotKey(initialWar.state.lastShot));
  const impactPulseTimeoutRef = useRef<number | null>(null);
  const shotAnimationFrameRef = useRef<number | null>(null);
  const warRef = useRef(initialWar);
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
  const [isChargingShot, setIsChargingShot] = useState(false);
  const [walkingPlayerIds, setWalkingPlayerIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [turnNotice, setTurnNotice] = useState("");
  const [cameraZoom, setCameraZoom] = useState(cameraFitZoom);
  const [cameraOrigin, setCameraOrigin] = useState<RaveWarShotPoint>(() => ({
    x: initialWar.level.width / 2,
    y: initialWar.level.height / 2
  }));
  const aimHoldIntervalRef = useRef<number | null>(null);
  const aimHoldDirectionRef = useRef<"down" | "up" | null>(null);
  const angleRef = useRef(angle);
  const aimFacingRef = useRef(aimFacing);
  const busyRef = useRef(busy);
  const canControlRef = useRef(false);
  const chargeFrameRef = useRef<number | null>(null);
  const chargeStartedAtRef = useRef(0);
  const isChargingShotRef = useRef(false);
  const moveHoldDirectionRef = useRef<RaveWarMoveDirection | null>(null);
  const moveHoldIntervalRef = useRef<number | null>(null);
  const moveInFlightRef = useRef(false);
  const powerRef = useRef(power);
  const selectedWeaponRef = useRef<RaveWarWeaponId>(selectedWeapon);
  const canFireRef = useRef(false);
  const previousTurnUserIdRef = useRef<string | null>(null);
  const returnToLiveTimeoutRef = useRef<number | null>(null);
  const walkingTimeoutsRef = useRef(new Map<string, number>());
  const lastPlayerPositionsRef = useRef(
    new Map(initialWar.state.players.map((player) => [player.userId, { x: player.x, y: player.y }]))
  );
  const mapStyle = useMemo(
    () => ({
      backgroundColor: war.level.backgroundColor,
      backgroundImage: `linear-gradient(rgba(2, 5, 13, 0.08), rgba(2, 5, 13, 0.34)), url(${war.level.backgroundImageUrl})`,
      backgroundPosition: "center",
      backgroundSize: "cover"
    }),
    [war.level.backgroundColor, war.level.backgroundImageUrl]
  );
  const worldStyle = useMemo(
    () => ({
      transform: `scale(${cameraZoom})`,
      transformOrigin: `${percent(cameraOrigin.x, war.level.width)} ${percent(cameraOrigin.y, war.level.height)}`
    }),
    [cameraOrigin.x, cameraOrigin.y, cameraZoom, war.level.height, war.level.width]
  );
  const terrainMaskId = useMemo(() => `rave-war-terrain-mask-${war.id.replace(/[^a-zA-Z0-9_-]/g, "")}`, [war.id]);
  const canControl = war.status === "active" && war.turnUserId === currentUserId;
  const selectedWeaponDefinition = raveWarWeaponsById.get(selectedWeapon) ?? raveWarWeapons[0];
  const selectedWeaponAmmo = ammoForWeapon(currentPlayer, selectedWeapon);
  const canFire = canControl && !busy && selectedWeaponAmmo > 0;
  const canAccept = war.status === "pending" && war.currentUserRole === "target";
  const visibleShotPath = animatedShot?.trail ?? [];
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
  const visibleShotWeapon = animatedShot ? raveWarWeaponsById.get(animatedShot.weaponId) ?? lastWeapon : lastWeapon;
  const visibleProjectileSize = visibleShotWeapon.projectileSize;
  const turnEndsAtMs = war.state.turnEndsAt ? Date.parse(war.state.turnEndsAt) : Number.NaN;
  const remainingTurnSeconds = Number.isFinite(turnEndsAtMs) ? Math.max(0, Math.ceil((turnEndsAtMs - nowMs) / 1000)) : null;
  const warEndsAtMs = war.state.warEndsAt ? Date.parse(war.state.warEndsAt) : Number.NaN;
  const remainingWarSeconds = Number.isFinite(warEndsAtMs) ? Math.max(0, Math.ceil((warEndsAtMs - nowMs) / 1000)) : null;
  const terminalWar = terminalRaveWarStatuses.has(war.status);
  const turnAnnouncement =
    war.status === "active"
      ? canControl
        ? "Your turn. Line up the shot."
        : activePlayer
          ? `${activePlayer.displayName}'s turn. Hold tight.`
          : "Turn changing."
      : terminalWar
        ? winner
          ? `${winner.displayName} wins. Returning to live.`
          : "Rave War finished. Returning to live."
        : "Waiting for the challenge.";
  const hudPlayers = war.state.players.slice().sort((first, second) => first.playerIndex - second.playerIndex);

  useEffect(() => {
    angleRef.current = angle;
    aimFacingRef.current = aimFacing;
    busyRef.current = busy;
    canControlRef.current = canControl;
    canFireRef.current = canFire;
    powerRef.current = power;
    selectedWeaponRef.current = selectedWeapon;
    warRef.current = war;
  }, [aimFacing, angle, busy, canControl, canFire, power, selectedWeapon, war]);

  useEffect(() => {
    const runtime = window as Window & {
      BouncecoreAndroid?: {
        setRaveWarControlState?: (canControl: boolean, canFire: boolean, status: string, weaponLabel: string, ammo: number) => void;
      };
    };
    const status = terminalWar
      ? winner
        ? `${winner.displayName} wins`
        : "Match finished"
      : war.status !== "active"
        ? "Waiting for match"
        : canControl
          ? `Your turn ${formatCountdown(remainingTurnSeconds)}`
          : `${activePlayer?.displayName ?? "Opponent"}'s turn ${formatCountdown(remainingTurnSeconds)}`;

    runtime.BouncecoreAndroid?.setRaveWarControlState?.(
      canControl && !busy,
      canFire,
      status,
      selectedWeaponDefinition.label,
      selectedWeaponAmmo
    );
  }, [activePlayer?.displayName, busy, canControl, canFire, remainingTurnSeconds, selectedWeaponAmmo, selectedWeaponDefinition.label, terminalWar, war.status, winner]);

  const markPlayerWalking = useCallback((userId: string) => {
    setWalkingPlayerIds((current) => {
      const next = new Set(current);
      next.add(userId);
      return next;
    });

    const existingTimeout = walkingTimeoutsRef.current.get(userId);

    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
    }

    const timeout = window.setTimeout(() => {
      setWalkingPlayerIds((current) => {
        if (!current.has(userId)) {
          return current;
        }

        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      walkingTimeoutsRef.current.delete(userId);
    }, 720);

    walkingTimeoutsRef.current.set(userId, timeout);
  }, [setWalkingPlayerIds]);

  const applyWar = useCallback((nextWar: RaveWarSummary) => {
    setWar(nextWar);
    setError(null);

    const nextCurrentPlayer = nextWar.state.players.find((player) => player.userId === currentUserId);
    const seenUserIds = new Set<string>();

    for (const player of nextWar.state.players) {
      seenUserIds.add(player.userId);

      const previousPosition = lastPlayerPositionsRef.current.get(player.userId);

      if (previousPosition && Math.abs(previousPosition.x - player.x) > 1) {
        markPlayerWalking(player.userId);
      }

      lastPlayerPositionsRef.current.set(player.userId, { x: player.x, y: player.y });
    }

    for (const userId of lastPlayerPositionsRef.current.keys()) {
      if (!seenUserIds.has(userId)) {
        lastPlayerPositionsRef.current.delete(userId);
      }
    }

    if (nextCurrentPlayer) {
      setAngle(nextCurrentPlayer.angle);
      setAimFacing(nextCurrentPlayer.facing);
      setPower(nextCurrentPlayer.power);
      setSelectedWeapon(nextCurrentPlayer.selectedWeapon);
    }
  }, [currentUserId, markPlayerWalking, setAimFacing, setAngle, setError, setPower, setSelectedWeapon, setWar]);

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

  const startShotAnimation = useCallback(
    (input: {
      damage: number;
      impactKind: RaveWarLastShot["impactKind"];
      impactPoint: RaveWarShotPoint;
      key: string;
      path: RaveWarShotPoint[];
      playFire?: boolean;
      showImpact?: boolean;
      weaponId: RaveWarWeaponId;
    }) => {
      if (shotAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(shotAnimationFrameRef.current);
        shotAnimationFrameRef.current = null;
      }

      if (impactPulseTimeoutRef.current !== null) {
        window.clearTimeout(impactPulseTimeoutRef.current);
        impactPulseTimeoutRef.current = null;
      }

      const path = [...input.path, input.impactPoint].filter((point, index, points) => {
        const previous = points[index - 1];
        return !previous || previous.x !== point.x || previous.y !== point.y;
      });
      const animationPath = path.length ? path : [input.impactPoint];
      const duration = clampNumber(animationPath.length * 18, shotAnimationMinMs, shotAnimationMaxMs);
      const startedAt = window.performance.now();

      if (input.playFire) {
        playRaveWarSfx("fire");
      }

      setImpactPulse(null);

      function tick(now: number) {
        const progress = clampNumber((now - startedAt) / duration, 0, 1);
        const index = Math.min(animationPath.length - 1, Math.floor(progress * (animationPath.length - 1)));

        setAnimatedShot({
          key: input.key,
          point: animationPath[index] ?? input.impactPoint,
          trail: animationPath.slice(0, index + 1),
          weaponId: input.weaponId
        });

        if (progress < 1) {
          shotAnimationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        shotAnimationFrameRef.current = null;
        setAnimatedShot(null);

        if (!input.showImpact) {
          return;
        }

        setImpactPulse({
          damage: input.damage,
          impactKind: input.impactKind,
          key: input.key,
          point: input.impactPoint
        });
        playRaveWarSfx(input.damage > 0 ? "hit" : input.impactKind === "out-of-bounds" ? "miss" : "impact");

        impactPulseTimeoutRef.current = window.setTimeout(() => {
          setImpactPulse((current) => (current?.key === input.key ? null : current));
          impactPulseTimeoutRef.current = null;
        }, 900);
      }

      shotAnimationFrameRef.current = window.requestAnimationFrame(tick);
    },
    [setAnimatedShot, setImpactPulse]
  );

  const updateAimFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const element = battlefieldRef.current;

      if (!element || !currentPlayer || !canControl) {
        return;
      }

      const nextAim = aimSettingsFromLevelPoint(
        currentPlayer,
        levelPointFromPointer(event, element, war.level, cameraZoom, cameraOrigin),
        war.level
      );

      setAngle(nextAim.angle);
      angleRef.current = nextAim.angle;
      setAimFacing(nextAim.facing);
      aimFacingRef.current = nextAim.facing;
    },
    [cameraOrigin, cameraZoom, canControl, currentPlayer, setAimFacing, setAngle, war.level]
  );

  const fireCurrentShotWithPower = useCallback(
    async (shotPower?: number) => {
      if (!canFireRef.current || busyRef.current) {
        playRaveWarSfx("blocked");
        return;
      }

      const nextPower = Math.round(clampNumber(shotPower ?? powerRef.current, 10, 100));
      const nextAngle = Math.round(angleRef.current);
      const weaponId = selectedWeaponRef.current;
      const currentWar = warRef.current;
      const shooter = currentWar.state.players.find((player) => player.userId === currentUserId);
      const target = currentWar.state.players.find((player) => player.userId !== currentUserId && player.health > 0);

      if (shooter && weaponAmmoOrDefault(shooter.weaponAmmo, weaponId) <= 0) {
        setError(`${raveWarWeaponsById.get(weaponId)?.label ?? "Weapon"} is out of ammo.`);
        playRaveWarSfx("blocked");
        return;
      }

      setPower(nextPower);
      powerRef.current = nextPower;
      playRaveWarSfx("fire");

      if (shooter && target) {
        const optimisticShot = simulateRaveWarShot({
          angle: nextAngle,
          craters: currentWar.state.craters,
          level: currentWar.level,
          power: nextPower,
          shooter: {
            ...shooter,
            angle: nextAngle,
            facing: aimFacingRef.current,
            power: nextPower,
            selectedWeapon: weaponId
          },
          target,
          weaponId,
          wind: currentWar.state.wind
        });

        startShotAnimation({
          damage: 0,
          impactKind: optimisticShot.impactKind,
          impactPoint: optimisticShot.impactPoint,
          key: `local:${Date.now()}:${weaponId}`,
          path: optimisticShot.path,
          showImpact: false,
          weaponId
        });
      }

      await postWarAction("fire", {
        angle: nextAngle,
        facing: aimFacingRef.current,
        power: nextPower,
        weaponId
      });
    },
    [currentUserId, postWarAction, setError, setPower, startShotAnimation]
  );

  const stopChargingShot = useCallback(
    (shouldFire: boolean) => {
      if (!isChargingShotRef.current) {
        return;
      }

      isChargingShotRef.current = false;
      setIsChargingShot(false);

      if (chargeFrameRef.current !== null) {
        window.cancelAnimationFrame(chargeFrameRef.current);
        chargeFrameRef.current = null;
      }

      if (shouldFire) {
        void fireCurrentShotWithPower(powerRef.current);
      }
    },
    [fireCurrentShotWithPower, setIsChargingShot]
  );

  const startChargingShot = useCallback(() => {
    if (!canControlRef.current || busyRef.current || isChargingShotRef.current) {
      return;
    }

    isChargingShotRef.current = true;
    setIsChargingShot(true);
    chargeStartedAtRef.current = window.performance.now();
    setPower(10);
    powerRef.current = 10;

    function tick(now: number) {
      if (!isChargingShotRef.current) {
        return;
      }

      const progress = clampNumber((now - chargeStartedAtRef.current) / chargeDurationMs, 0, 1);
      const nextPower = 10 + progress * 90;

      setPower(nextPower);
      powerRef.current = nextPower;

      if (progress < 1) {
        chargeFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        chargeFrameRef.current = null;
      }
    }

    chargeFrameRef.current = window.requestAnimationFrame(tick);
  }, [setIsChargingShot, setPower]);

  const handleBattlefieldPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canControl || event.button !== 0) {
        return;
      }

      event.preventDefault();
      setIsAiming(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      updateAimFromPointer(event);
      startChargingShot();
    },
    [canControl, setIsAiming, startChargingShot, updateAimFromPointer]
  );

  const handleBattlefieldPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canControl) {
        return;
      }

      if (event.pointerType === "mouse" || isAiming) {
        updateAimFromPointer(event);
      }
    },
    [canControl, isAiming, updateAimFromPointer]
  );

  const handleBattlefieldPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      setIsAiming(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopChargingShot(true);
    },
    [setIsAiming, stopChargingShot]
  );

  const handleBattlefieldPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      setIsAiming(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopChargingShot(false);
    },
    [setIsAiming, stopChargingShot]
  );

  const fireCurrentShot = useCallback(async () => {
    await fireCurrentShotWithPower(powerRef.current);
  }, [fireCurrentShotWithPower]);

  const selectWeapon = useCallback(
    (weaponId: RaveWarWeaponId) => {
      selectedWeaponRef.current = weaponId;
      setSelectedWeapon(weaponId);
    },
    [setSelectedWeapon]
  );

  const cycleSelectedWeapon = useCallback((direction: -1 | 1) => {
    const player = warRef.current.state.players.find((entry) => entry.userId === currentUserId);

    setSelectedWeapon((current) => {
      const currentIndex = raveWarWeapons.findIndex((weapon) => weapon.id === current);
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

      for (let offset = 1; offset <= raveWarWeapons.length; offset += 1) {
        const nextIndex = (safeCurrentIndex + direction * offset + raveWarWeapons.length) % raveWarWeapons.length;
        const nextWeapon = raveWarWeapons[nextIndex]?.id ?? "bazooka";

        if (ammoForWeapon(player, nextWeapon) <= 0) {
          continue;
        }

        selectedWeaponRef.current = nextWeapon;
        return nextWeapon;
      }

      selectedWeaponRef.current = current;
      return current;
    });
  }, [currentUserId, setSelectedWeapon]);

  const adjustCameraZoom = useCallback((direction: -1 | 1, focusOnTurn = true) => {
    if (focusOnTurn) {
      const currentWar = warRef.current;
      const focusPlayer = currentWar.state.players.find((player) => player.userId === currentWar.turnUserId);

      if (focusPlayer) {
        setCameraOrigin({ x: focusPlayer.x, y: focusPlayer.y - 90 });
      }
    }

    setCameraZoom((current) => clampNumber(current + direction * cameraZoomStep, cameraMinZoom, cameraMaxZoom));
  }, [setCameraOrigin, setCameraZoom]);

  const resetCamera = useCallback(() => {
    const level = warRef.current.level;
    setCameraOrigin({ x: level.width / 2, y: level.height / 2 });
    setCameraZoom(cameraFitZoom);
  }, [setCameraOrigin, setCameraZoom]);

  const handleBattlefieldWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const element = battlefieldRef.current;

      if (!element) {
        return;
      }

      event.preventDefault();
      setCameraOrigin(levelPointFromPointer(event, element, war.level, cameraZoom, cameraOrigin));
      adjustCameraZoom(event.deltaY < 0 ? 1 : -1, false);
    },
    [adjustCameraZoom, cameraOrigin, cameraZoom, setCameraOrigin, war.level]
  );

  const moveCurrentPlayer = useCallback(
    async (direction: RaveWarMoveDirection) => {
      if (!canControlRef.current || busyRef.current) {
        playRaveWarSfx("blocked");
        return;
      }

      if (moveInFlightRef.current) {
        return;
      }

      moveInFlightRef.current = true;
      setAimFacing(direction);
      aimFacingRef.current = direction;
      markPlayerWalking(currentUserId);

      try {
        await postWarAction("move", { direction });
      } finally {
        moveInFlightRef.current = false;
      }
    },
    [currentUserId, markPlayerWalking, postWarAction, setAimFacing]
  );

  const stopMoveHold = useCallback((direction?: RaveWarMoveDirection) => {
    if (direction && moveHoldDirectionRef.current !== direction) {
      return;
    }

    moveHoldDirectionRef.current = null;

    if (moveHoldIntervalRef.current !== null) {
      window.clearInterval(moveHoldIntervalRef.current);
      moveHoldIntervalRef.current = null;
    }
  }, []);

  const startMoveHold = useCallback(
    (direction: RaveWarMoveDirection) => {
      if (moveHoldDirectionRef.current === direction) {
        return;
      }

      stopMoveHold();
      moveHoldDirectionRef.current = direction;
      void moveCurrentPlayer(direction);
      moveHoldIntervalRef.current = window.setInterval(() => {
        if (moveHoldDirectionRef.current === direction) {
          void moveCurrentPlayer(direction);
        }
      }, moveHoldIntervalMs);
    },
    [moveCurrentPlayer, stopMoveHold]
  );

  const adjustAim = useCallback((direction: "down" | "up") => {
    setAngle((current) => {
      const nextAngle = clampNumber(current + (direction === "up" ? aimHoldStep : -aimHoldStep), 0, 90);

      angleRef.current = nextAngle;
      return nextAngle;
    });
  }, [setAngle]);

  const stopAimHold = useCallback((direction?: "down" | "up") => {
    if (direction && aimHoldDirectionRef.current !== direction) {
      return;
    }

    aimHoldDirectionRef.current = null;

    if (aimHoldIntervalRef.current !== null) {
      window.clearInterval(aimHoldIntervalRef.current);
      aimHoldIntervalRef.current = null;
    }
  }, []);

  const startAimHold = useCallback(
    (direction: "down" | "up") => {
      if (aimHoldDirectionRef.current === direction) {
        return;
      }

      stopAimHold();
      aimHoldDirectionRef.current = direction;
      adjustAim(direction);
      aimHoldIntervalRef.current = window.setInterval(() => {
        if (aimHoldDirectionRef.current === direction) {
          adjustAim(direction);
        }
      }, aimHoldIntervalMs);
    },
    [adjustAim, stopAimHold]
  );

  const handleNativeControl = useCallback(
    (control: RaveWarNativeControl, state: RaveWarNativeControlState) => {
      const isCameraControl = control === "zoom-in" || control === "zoom-out";

      if (!isCameraControl && state !== "up" && (!canControlRef.current || busyRef.current)) {
        playRaveWarSfx("blocked");
        return;
      }

      if (control === "left" || control === "right") {
        if (state === "down") {
          startMoveHold(control);
        } else if (state === "up") {
          stopMoveHold(control);
        }

        return;
      }

      if (control === "aim-up" || control === "aim-down") {
        const aimDirection = control === "aim-up" ? "up" : "down";

        if (state === "down") {
          startAimHold(aimDirection);
        } else if (state === "up") {
          stopAimHold(aimDirection);
        }

        return;
      }

      if (control === "fire") {
        if (state === "down") {
          startChargingShot();
        } else if (state === "up") {
          stopChargingShot(true);
        }

        return;
      }

      if (control === "weapon-next" && state !== "down") {
        cycleSelectedWeapon(1);
        return;
      }

      if (control === "weapon-prev" && state !== "down") {
        cycleSelectedWeapon(-1);
        return;
      }

      if (control === "zoom-in" && state !== "down") {
        adjustCameraZoom(1);
        return;
      }

      if (control === "zoom-out" && state !== "down") {
        adjustCameraZoom(-1);
      }
    },
    [adjustCameraZoom, cycleSelectedWeapon, startAimHold, startChargingShot, startMoveHold, stopAimHold, stopChargingShot, stopMoveHold]
  );

  useEffect(() => {
    if (canControl && !busy) {
      return;
    }

    stopMoveHold();
    stopAimHold();
    stopChargingShot(false);
  }, [busy, canControl, stopAimHold, stopChargingShot, stopMoveHold]);

  useEffect(() => {
    if (war.status !== "active") {
      return undefined;
    }

    const interval = window.setInterval(() => setNowMs(Date.now()), 500);

    return () => window.clearInterval(interval);
  }, [war.status]);

  useEffect(() => {
    window.sessionStorage.setItem(`rave-war-opened:${war.id}`, "1");
  }, [war.id]);

  useEffect(() => {
    if (war.status !== "active") {
      previousTurnUserIdRef.current = war.turnUserId;
      return;
    }

    if (previousTurnUserIdRef.current === war.turnUserId) {
      return;
    }

    previousTurnUserIdRef.current = war.turnUserId;
    setTurnNotice(turnAnnouncement);

    const timeout = window.setTimeout(() => {
      setTurnNotice((current) => (current === turnAnnouncement ? "" : current));
    }, canControl ? 2400 : 3200);

    return () => window.clearTimeout(timeout);
  }, [canControl, turnAnnouncement, war.status, war.turnUserId]);

  useEffect(() => {
    if (!terminalWar) {
      if (returnToLiveTimeoutRef.current !== null) {
        window.clearTimeout(returnToLiveTimeoutRef.current);
        returnToLiveTimeoutRef.current = null;
      }

      return undefined;
    }

    if (returnToLiveTimeoutRef.current !== null) {
      return undefined;
    }

    returnToLiveTimeoutRef.current = window.setTimeout(() => {
      window.location.assign("/live");
    }, liveReturnDelayMs);

    return () => {
      if (returnToLiveTimeoutRef.current !== null) {
        window.clearTimeout(returnToLiveTimeoutRef.current);
        returnToLiveTimeoutRef.current = null;
      }
    };
  }, [terminalWar]);

  useEffect(() => {
    document.documentElement.classList.add("bc-rave-war-active");

    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: OrientationLockType) => Promise<void>;
      unlock?: () => void;
    };

    void orientation.lock?.("landscape").catch(() => undefined);

    return () => {
      document.documentElement.classList.remove("bc-rave-war-active");
      orientation.unlock?.();
    };
  }, []);

  useEffect(() => {
    const runtime = window as Window & {
      BouncecoreAndroid?: {
        setRaveWarActive?: (active: boolean) => void;
      };
    };

    runtime.BouncecoreAndroid?.setRaveWarActive?.(true);

    return () => {
      runtime.BouncecoreAndroid?.setRaveWarActive?.(false);
    };
  }, []);

  useEffect(() => {
    function handleNativeControlEvent(event: Event) {
      const detail = (event as CustomEvent<{ control?: string; state?: string }>).detail;
      const control = detail?.control;
      const state = detail?.state;
      const validControls: RaveWarNativeControl[] = ["aim-down", "aim-up", "fire", "left", "right", "weapon-next", "weapon-prev", "zoom-in", "zoom-out"];
      const validStates: RaveWarNativeControlState[] = ["down", "press", "up"];

      if (!validControls.includes(control as RaveWarNativeControl) || !validStates.includes(state as RaveWarNativeControlState)) {
        return;
      }

      handleNativeControl(control as RaveWarNativeControl, state as RaveWarNativeControlState);
    }

    window.addEventListener("bouncecore:rave-war-native-control", handleNativeControlEvent);

    return () => {
      window.removeEventListener("bouncecore:rave-war-native-control", handleNativeControlEvent);
    };
  }, [handleNativeControl]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (gameInputShouldIgnoreTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        handleNativeControl("left", "down");
        return;
      }

      if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        handleNativeControl("right", "down");
        return;
      }

      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        handleNativeControl("aim-up", "down");
        return;
      }

      if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        handleNativeControl("aim-down", "down");
        return;
      }

      if (event.key === " " && !event.repeat) {
        event.preventDefault();
        handleNativeControl("fire", "down");
        return;
      }

      if ((key === "q" || key === "e") && !event.repeat) {
        event.preventDefault();
        handleNativeControl(key === "q" ? "weapon-prev" : "weapon-next", "press");
        return;
      }

      if (event.key === "Enter" && !event.repeat) {
        event.preventDefault();
        void fireCurrentShot();
      }
    }

    function handleKeyUp(event: globalThis.KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        handleNativeControl("left", "up");
        return;
      }

      if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        handleNativeControl("right", "up");
        return;
      }

      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        handleNativeControl("aim-up", "up");
        return;
      }

      if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        handleNativeControl("aim-down", "up");
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        handleNativeControl("fire", "up");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      stopMoveHold();
      stopAimHold();
      stopChargingShot(false);
    };
  }, [fireCurrentShot, handleNativeControl, stopAimHold, stopChargingShot, stopMoveHold]);

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

    latestAnimatedShotKeyRef.current = nextShotKey;
    startShotAnimation({
      damage: lastShot.damage,
      impactKind: lastShot.impactKind,
      impactPoint: lastShot.impactPoint,
      key: nextShotKey,
      path: lastShot.path,
      playFire: lastShot.shooterUserId !== currentUserId,
      showImpact: true,
      weaponId: lastShot.weaponId
    });

    return undefined;
  }, [currentUserId, startShotAnimation, war.state.lastShot]);

  useEffect(
    () => () => {
      if (impactPulseTimeoutRef.current !== null) {
        window.clearTimeout(impactPulseTimeoutRef.current);
      }

      if (aimHoldIntervalRef.current !== null) {
        window.clearInterval(aimHoldIntervalRef.current);
      }

      if (chargeFrameRef.current !== null) {
        window.cancelAnimationFrame(chargeFrameRef.current);
      }

      if (moveHoldIntervalRef.current !== null) {
        window.clearInterval(moveHoldIntervalRef.current);
      }

      if (shotAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(shotAnimationFrameRef.current);
      }

      if (returnToLiveTimeoutRef.current !== null) {
        window.clearTimeout(returnToLiveTimeoutRef.current);
      }

      for (const timeout of walkingTimeoutsRef.current.values()) {
        window.clearTimeout(timeout);
      }

      walkingTimeoutsRef.current.clear();
    },
    []
  );

  return (
    <section className="bc-rave-war-shell fixed inset-0 z-[80] flex h-dvh w-dvw max-w-none flex-col gap-2 overflow-hidden bg-bc-void p-2 lg:gap-3 lg:p-3">
      <div className="bc-rave-war-rotate-prompt pointer-events-none absolute inset-0 z-30 hidden place-items-center bg-bc-void/96 p-6 text-center">
        <div className="max-w-xs rounded-md border border-bc-electric/40 bg-bc-panel p-5 shadow-2xl shadow-black/50">
          <Swords className="mx-auto h-10 w-10 text-bc-electric" aria-hidden="true" />
          <p className="mt-3 text-lg font-black">Rotate to landscape</p>
          <p className="mt-2 text-sm text-bc-muted">Rave War uses a wide battlefield and mobile controls while the battle is active.</p>
        </div>
      </div>

      <header className="bc-rave-war-header flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-bc-line bg-bc-panel p-2 lg:gap-3 lg:p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/45 bg-bc-electric/10 text-bc-electric">
            <Swords className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={war.status === "active" ? "acid" : war.status === "finished" ? "pink" : "cyan"}>{formatStatus(war.status)}</Badge>
              <Badge tone="muted">#{war.roomSlug}</Badge>
              <Badge tone={remainingWarSeconds !== null && remainingWarSeconds <= 30 ? "pink" : "cyan"}>War {formatCountdown(remainingWarSeconds)}</Badge>
              <Badge tone={remainingTurnSeconds !== null && remainingTurnSeconds <= 10 ? "pink" : "amber"}>Turn {formatCountdown(remainingTurnSeconds)}</Badge>
            </div>
            <h1 className="mt-1 truncate text-base font-black lg:text-xl">{war.level.name}</h1>
          </div>
        </div>
        <Link className="bc-focus-ring rounded-md border border-bc-line px-3 py-2 text-sm font-semibold text-white transition hover:border-bc-electric/60" href="/live">
          Back to live
        </Link>
      </header>

      <div className="bc-rave-war-layout grid min-h-0 flex-1 gap-2 overflow-hidden lg:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)]">
        <div className="bc-rave-war-stage-card min-h-0 overflow-hidden rounded-md border border-bc-line bg-bc-panel p-1.5 lg:p-2">
          <div
            aria-label="Rave War battlefield. Move the mouse to aim. Hold the mouse button or Space to build power, then release to fire. Hold left and right or A and D to walk. Hold up and down or W and S to aim. Press Q and E for weapons."
            className={`bc-rave-war-battlefield relative aspect-[2/1] w-full max-w-full min-h-[220px] overflow-hidden rounded-md border border-bc-line bg-cover bg-center ${
              canFire ? "cursor-crosshair touch-none" : "cursor-default"
            }`}
            data-charging={isChargingShot ? "true" : "false"}
            onPointerCancel={handleBattlefieldPointerCancel}
            onPointerDown={handleBattlefieldPointerDown}
            onPointerLeave={() => setIsAiming(false)}
            onPointerMove={handleBattlefieldPointerMove}
            onPointerUp={handleBattlefieldPointerUp}
            onWheel={handleBattlefieldWheel}
            ref={battlefieldRef}
            role="application"
            style={mapStyle}
            tabIndex={canFire ? 0 : -1}
          >
            <div className="bc-rave-war-titleplate pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 text-center">
              <p className="bc-rave-war-logo-text">Rave War</p>
              <p className="bc-rave-war-round-label">Turn {war.state.turnNumber}</p>
            </div>

            <div className="bc-rave-war-hud pointer-events-none absolute inset-x-2 top-2 z-20 grid grid-cols-2 gap-2">
              {hudPlayers.map((player) => {
                const side = playerHudSide(player.playerIndex);

                return (
                  <article className="bc-rave-war-player-card" data-side={side} key={player.userId} style={{ "--rave-war-player-color": player.color } as CSSProperties}>
                    <div className="bc-rave-war-player-portrait" aria-hidden="true">
                      {player.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black uppercase lg:text-lg">{player.displayName}</p>
                      <div className="bc-rave-war-player-health mt-1 flex items-center gap-2">
                        <span className="text-sm font-black lg:text-xl">{player.health}</span>
                        <HeartPulse className="h-4 w-4 text-bc-pink lg:h-5 lg:w-5" aria-hidden="true" />
                      </div>
                      <div className="bc-rave-war-health-segments mt-1 grid grid-cols-5 gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span
                            className="h-2 rounded-sm bg-black/55 shadow-inner"
                            key={`${player.userId}-health-${index}`}
                          >
                            <span
                              className="block h-full rounded-sm"
                              style={{
                                background: index * 20 < player.health ? player.color : "transparent",
                                boxShadow: index * 20 < player.health ? `0 0 10px ${player.color}` : "none"
                              }}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="bc-rave-war-wind-panel pointer-events-none absolute left-3 top-[20%] z-20 hidden rounded-md border border-white/20 bg-black/70 p-2 text-white shadow-2xl shadow-black/45 backdrop-blur md:block">
              <p className="text-xs font-black uppercase text-bc-muted">Wind</p>
              <p className="bc-rave-war-wind-value mt-1 text-xl font-black text-bc-acid">
                {Math.abs(Math.round(war.state.wind))} {war.state.wind < 0 ? "←" : "→"}
              </p>
            </div>

            <div
              aria-label="Battlefield zoom"
              className="bc-rave-war-camera-controls absolute left-3 top-[35%] z-30 grid gap-1 rounded-md border border-white/20 bg-black/70 p-1 shadow-2xl shadow-black/45 backdrop-blur"
              onPointerCancel={stopBattlefieldControlEvent}
              onPointerDown={stopBattlefieldControlEvent}
              onPointerUp={stopBattlefieldControlEvent}
            >
              <button aria-label="Zoom battlefield in" className="bc-focus-ring grid h-8 w-8 place-items-center rounded-sm text-white hover:bg-white/10" onClick={() => adjustCameraZoom(1)} title="Zoom in" type="button">
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
              <button aria-label="Show full battlefield" className="bc-focus-ring grid h-8 w-8 place-items-center rounded-sm text-bc-acid hover:bg-white/10" onClick={resetCamera} title="Fit full map" type="button">
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button aria-label="Zoom battlefield out" className="bc-focus-ring grid h-8 w-8 place-items-center rounded-sm text-white hover:bg-white/10" onClick={() => adjustCameraZoom(-1)} title="Zoom out" type="button">
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-center text-[9px] font-black text-bc-muted">{Math.round(cameraZoom * 100)}%</span>
            </div>

            <div className="bc-rave-war-turn-announcer pointer-events-none absolute left-1/2 top-[18%] z-30 -translate-x-1/2" aria-live="polite">
              {(turnNotice || terminalWar) ? (
                <div className="bc-rave-war-announcement">
                  <p>{terminalWar ? turnAnnouncement : turnNotice}</p>
                  <span>{formatCountdown(remainingTurnSeconds)}</span>
                </div>
              ) : null}
            </div>

            <div
              className="bc-rave-war-weapon-dock hidden lg:grid"
              onPointerCancel={stopBattlefieldControlEvent}
              onPointerDown={stopBattlefieldControlEvent}
              onPointerUp={stopBattlefieldControlEvent}
            >
              <p className="text-center text-sm font-black uppercase text-bc-pink">Weapons</p>
              {raveWarWeapons.map((weapon) => {
                const ammo = ammoForWeapon(currentPlayer, weapon.id);

                return (
                  <button
                    aria-pressed={selectedWeapon === weapon.id}
                    className={`bc-focus-ring bc-rave-war-weapon-tile ${selectedWeapon === weapon.id ? "is-selected" : ""}`}
                    disabled={!canControl || busy || ammo <= 0}
                    key={weapon.id}
                    onClick={() => selectWeapon(weapon.id)}
                    title={weapon.description}
                    type="button"
                  >
                    <Image alt="" className="h-9 w-9 object-contain" height={36} src={weapon.iconUrl} unoptimized width={36} />
                    <span>{weapon.label}</span>
                    <strong>{weapon.starCost > 0 ? `x${ammo} · ${weapon.starCost}★` : `x${ammo}`}</strong>
                  </button>
                );
              })}
            </div>

            <div
              className="bc-rave-war-bottom-hud pointer-events-none absolute inset-x-3 bottom-3 z-20 hidden items-end justify-between gap-3 lg:flex"
              onPointerCancel={stopBattlefieldControlEvent}
              onPointerDown={stopBattlefieldControlEvent}
              onPointerUp={stopBattlefieldControlEvent}
            >
              <div className="grid w-64 gap-2 rounded-md border border-white/20 bg-black/70 p-2 shadow-2xl shadow-black/45 backdrop-blur">
                <div>
                  <div className="flex items-center justify-between text-xs font-black uppercase">
                    <span className="text-bc-pink">Power</span>
                    <span className="text-white">{Math.round(power)}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <span className={`h-3 rounded-sm ${index * 10 < power ? "bg-bc-pink shadow-[0_0_10px_rgba(255,63,164,0.8)]" : "bg-white/15"}`} key={`power-${index}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-black uppercase">
                    <span className="text-bc-pink">Angle</span>
                    <span className="text-white">{Math.round(angle)} deg</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full bg-bc-pink shadow-[0_0_12px_rgba(255,63,164,0.9)]" style={{ width: percent(angle, 90) }} />
                  </div>
                </div>
              </div>
              <div className="grid place-items-center">
                <button
                  className="bc-focus-ring bc-rave-war-fire-button pointer-events-auto"
                  disabled={!canFire}
                  onClick={() => void fireCurrentShot()}
                  onPointerCancel={stopBattlefieldControlEvent}
                  onPointerDown={stopBattlefieldControlEvent}
                  onPointerUp={stopBattlefieldControlEvent}
                  type="button"
                >
                  Fire
                </button>
              </div>
            </div>

            <div className="bc-rave-war-world pointer-events-none absolute inset-0" style={worldStyle}>
            <svg
              aria-hidden="true"
              className="bc-rave-war-world-svg absolute inset-0 h-full w-full overflow-visible"
              overflow="visible"
              viewBox={`0 0 ${war.level.width} ${war.level.height}`}
            >
              <defs>
                <mask id={terrainMaskId}>
                  <rect fill="#ffffff" height={war.level.height} width={war.level.width} x="0" y="0" />
                  {war.state.craters.map((crater, index) => (
                    <circle cx={crater.x} cy={crater.y} fill="#000000" key={`${crater.x}-${crater.y}-${crater.radius}-mask-${index}`} r={crater.radius} />
                  ))}
                </mask>
              </defs>
              <image height={war.level.height} href={war.level.mapImageUrl} mask={`url(#${terrainMaskId})`} preserveAspectRatio="none" width={war.level.width} x="0" y="0" />
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
              {animatedShot ? (
                <>
                  <circle cx={animatedShot.point.x} cy={animatedShot.point.y} fill="rgba(163,255,18,0.35)" r="34" />
                  <image
                    height={visibleProjectileSize}
                    href={visibleShotWeapon.projectileUrl}
                    transform={`rotate(${shellRotation} ${animatedShot.point.x} ${animatedShot.point.y})`}
                    width={visibleProjectileSize}
                    x={animatedShot.point.x - visibleProjectileSize / 2}
                    y={animatedShot.point.y - visibleProjectileSize / 2}
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
                    <div className="bc-rave-war-character-anchor absolute bottom-0 left-1/2 -translate-x-1/2">
                      <RaveWormFrame
                        angle={player.userId === currentUserId ? angle : player.angle}
                        facing={displayFacing}
                        isWalking={walkingPlayerIds.has(player.userId)}
                        playerIndex={player.playerIndex}
                        showWeapon={war.status === "active"}
                        weapon={playerWeapon}
                      />
                    </div>
                    <div
                      className="absolute bottom-0 left-1/2 h-1.5 w-16 -translate-x-1/2 overflow-hidden rounded-full border border-black/60 bg-black/70"
                      style={{ boxShadow: `0 0 0 1px ${player.color}` }}
                    >
                      <div className={healthTone(player.health)} style={{ height: "100%", width: `${player.health}%` }} />
                    </div>
                    <div
                      className="bc-rave-war-player-name absolute left-1/2 max-w-28 -translate-x-1/2 truncate rounded-full border bg-black/65 px-2 py-0.5 text-center text-[10px] font-black text-white backdrop-blur-sm"
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
        </div>

        <aside className="bc-rave-war-sidebar grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
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
                      {formatCountdown(remainingTurnSeconds)}
                    </Badge>
                  </div>
                  {canFire ? (
                    <p className="mt-2 text-xs text-bc-muted">
                      Move the mouse to aim. Hold mouse or Space to build power, release to fire. Hold left/right or A/D to walk. Hold up/down or W/S to aim. Q/E changes weapons.
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="bc-focus-ring min-h-10 touch-none select-none rounded-md border border-bc-line bg-bc-ink px-3 text-xs font-black text-white transition hover:border-bc-electric/60 active:border-bc-electric active:bg-bc-electric/15 disabled:opacity-50"
                    disabled={!canFire || !currentPlayer?.movementLeft}
                    onContextMenu={(event) => event.preventDefault()}
                    onPointerCancel={(event) => {
                      stopBattlefieldControlEvent(event);
                      stopMoveHold("left");
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      stopBattlefieldControlEvent(event);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startMoveHold("left");
                    }}
                    onLostPointerCapture={() => stopMoveHold("left")}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      stopBattlefieldControlEvent(event);
                      stopMoveHold("left");

                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    type="button"
                  >
                    Hold to walk left
                  </button>
                  <button
                    className="bc-focus-ring min-h-10 touch-none select-none rounded-md border border-bc-line bg-bc-ink px-3 text-xs font-black text-white transition hover:border-bc-electric/60 active:border-bc-electric active:bg-bc-electric/15 disabled:opacity-50"
                    disabled={!canFire || !currentPlayer?.movementLeft}
                    onContextMenu={(event) => event.preventDefault()}
                    onPointerCancel={(event) => {
                      stopBattlefieldControlEvent(event);
                      stopMoveHold("right");
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      stopBattlefieldControlEvent(event);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startMoveHold("right");
                    }}
                    onLostPointerCapture={() => stopMoveHold("right")}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      stopBattlefieldControlEvent(event);
                      stopMoveHold("right");

                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    type="button"
                  >
                    Hold to walk right
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
                  <div className="grid grid-cols-2 gap-2">
                    {raveWarWeapons.map((weapon) => {
                      const ammo = ammoForWeapon(currentPlayer, weapon.id);

                      return (
                        <button
                          aria-pressed={selectedWeapon === weapon.id}
                          className={`bc-focus-ring grid min-h-16 place-items-center rounded-md border px-2 py-2 text-center text-[11px] font-black transition ${
                            selectedWeapon === weapon.id
                              ? "border-bc-electric bg-bc-electric/15 text-white"
                              : "border-bc-line bg-bc-ink text-bc-muted hover:border-bc-electric/50 hover:text-white"
                          }`}
                          disabled={!canControl || busy || ammo <= 0}
                          key={weapon.id}
                          onClick={() => selectWeapon(weapon.id)}
                          title={weapon.description}
                          type="button"
                        >
                          <Image alt="" className="h-7 w-7 object-contain" height={28} src={weapon.iconUrl} unoptimized width={28} />
                          <span>{weapon.label}</span>
                          <span className="text-[10px] text-bc-acid">x{ammo}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-bc-line bg-bc-ink p-2">
                    <p className="text-[10px] font-black uppercase text-bc-muted">Angle</p>
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setAngle((current) => {
                          const nextAngle = clampNumber(current - 2, 0, 90);

                          angleRef.current = nextAngle;
                          return nextAngle;
                        })}
                        type="button"
                      >
                        -2
                      </button>
                      <span className="min-w-10 text-center text-sm font-black text-bc-electric">{Math.round(angle)} deg</span>
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setAngle((current) => {
                          const nextAngle = clampNumber(current + 2, 0, 90);

                          angleRef.current = nextAngle;
                          return nextAngle;
                        })}
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
                        onClick={() => setPower((current) => {
                          const nextPower = clampNumber(current - 3, 10, 100);

                          powerRef.current = nextPower;
                          return nextPower;
                        })}
                        type="button"
                      >
                        -3
                      </button>
                      <span className="min-w-10 text-center text-sm font-black text-bc-pink">{Math.round(power)}%</span>
                      <button
                        className="bc-focus-ring min-h-8 flex-1 rounded-md border border-bc-line bg-bc-panel px-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={!canFire}
                        onClick={() => setPower((current) => {
                          const nextPower = clampNumber(current + 3, 10, 100);

                          powerRef.current = nextPower;
                          return nextPower;
                        })}
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
                    onChange={(event) => {
                      const nextAngle = Number(event.target.value);

                      angleRef.current = nextAngle;
                      setAngle(nextAngle);
                    }}
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
                    onChange={(event) => {
                      const nextPower = Number(event.target.value);

                      powerRef.current = nextPower;
                      setPower(nextPower);
                    }}
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
