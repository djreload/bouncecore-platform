"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePerformancePreferences } from "@/components/performance/use-performance-preferences";
import type { EffectivePerformancePreferences } from "@/lib/account/performance-preferences-core";
import type { ChatSheepThrowOverlayData, ChatSheepThrowSummary } from "@/lib/chat/sheep-throw-service";
import { defaultSheepThrowSettings, defaultSheepThrowSprite, type SheepThrowSettings, type SheepThrowSprite } from "@/lib/chat/sheep-throw-settings";

type LoadedImages = {
  glass: HTMLImageElement;
  sprite: SheepThrowSprite;
  spriteImage: HTMLImageElement;
};

type AndroidVibrationBridgeWindow = Window & {
  BouncecoreAndroid?: {
    vibrate?: (pattern: string) => void;
  };
};

const approachMs = 1150;
const frameMs = 38;
const impactShakeMs = 650;
const fadeMs = 520;
const maxOverlayDevicePixelRatio = 1.5;
const seenThrowStorageKey = "bouncecore.chat.seen-throw-overlays.v1";
const maxRememberedThrowIds = 96;
const incomingVibrationPattern = [80, 55, 120, 55, 170, 55, 230, 55, 300];
const impactVibrationPattern = [180, 45, 120, 45, 90];

function loadOverlayImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}.`));
    image.src = src;
  });
}

function easeOutBack(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
}

function hashText(value: string) {
  return value.split("").reduce((hash, character) => hash + character.charCodeAt(0), 0);
}

function fallbackThrowableGlyph(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("poop")) {
    return String.fromCodePoint(0x1f4a9);
  }

  if (normalized.includes("unicorn")) {
    return String.fromCodePoint(0x1f984);
  }

  if (normalized.includes("leaf")) {
    return String.fromCodePoint(0x1f343);
  }

  return String.fromCodePoint(0x1f411);
}

function readSeenThrowIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = JSON.parse(window.sessionStorage.getItem(seenThrowStorageKey) ?? "[]") as unknown;

    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(-maxRememberedThrowIds) : [];
  } catch {
    return [];
  }
}

function persistSeenThrowIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(seenThrowStorageKey, JSON.stringify([...ids].slice(-maxRememberedThrowIds)));
  } catch {
    // Private browsing or full storage must not stop a received throw.
  }
}

function throwLabel(sheepThrow: ChatSheepThrowSummary) {
  const spriteLabel = sheepThrow.sprite.label.toLowerCase();
  const article = /^(uni|user|use|euro)/.test(spriteLabel) ? "a" : /^[aeiou]/.test(spriteLabel) ? "an" : "a";

  return sheepThrow.targetDisplayName
    ? `${sheepThrow.throwerDisplayName} threw ${article} ${spriteLabel} at ${sheepThrow.targetDisplayName}`
    : `${sheepThrow.throwerDisplayName} threw ${article} ${spriteLabel}`;
}

function reducedMotionEnabled(performancePreferences?: EffectivePerformancePreferences) {
  return (
    performancePreferences?.animationsEnabled === false ||
    (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function mobileVibrationAvailable() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }

  return navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function vibrateMobile(pattern: number | number[], enabled: boolean) {
  if (!enabled || reducedMotionEnabled()) {
    return;
  }

  const androidBridge = (window as AndroidVibrationBridgeWindow).BouncecoreAndroid;
  if (typeof androidBridge?.vibrate === "function") {
    androidBridge.vibrate(Array.isArray(pattern) ? pattern.join(",") : String(pattern));
    return;
  }

  if (!mobileVibrationAvailable()) {
    return;
  }

  navigator.vibrate(pattern);
}

export function SheepThrowOverlay() {
  const { effective: performancePreferences } = usePerformancePreferences();
  const [activeThrow, setActiveThrow] = useState<ChatSheepThrowSummary | null>(null);
  const [incomingBlur, setIncomingBlur] = useState(false);
  const [settings, setSettings] = useState<SheepThrowSettings>(defaultSheepThrowSettings);
  const [visualFallback, setVisualFallback] = useState(false);
  const activeThrowRef = useRef<ChatSheepThrowSummary | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCacheRef = useRef(new Map<string, HTMLAudioElement>());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializedRef = useRef(false);
  const imageRef = useRef<LoadedImages | null>(null);
  const imageCacheRef = useRef(new Map<string, LoadedImages>());
  const drawFrameRef = useRef<(timestamp: number) => void>(() => undefined);
  const playNextRef = useRef<() => void>(() => undefined);
  const performancePreferencesRef = useRef(performancePreferences);
  const queueRef = useRef<ChatSheepThrowSummary[]>([]);
  const seenIdsRef = useRef(new Set<string>());
  const settingsRef = useRef(settings);
  const startTimeRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const impactTriggeredRef = useRef(false);
  const loadingThrowRef = useRef(false);
  const wobbleTimeoutRef = useRef<number | null>(null);
  const activeLabel = useMemo(() => (activeThrow ? throwLabel(activeThrow) : ""), [activeThrow]);

  const playImpactSound = useCallback((soundUrl: string | null | undefined) => {
    if (!soundUrl || typeof window === "undefined") {
      return;
    }

    const cached = audioCacheRef.current.get(soundUrl) ?? new Audio(soundUrl);

    cached.preload = "auto";
    audioCacheRef.current.set(soundUrl, cached);

    const player = cached.cloneNode(true) as HTMLAudioElement;

    player.volume = 0.72;
    void player.play().catch(() => {
      // Mobile browsers can block autoplay-style sound until the viewer has interacted.
    });
  }, []);

  const loadImagesForSprite = useCallback(async (sprite: SheepThrowSprite): Promise<LoadedImages> => {
    const cacheKey = `${sprite.id}:${sprite.spriteSheetUrl}:${sprite.glassSmashUrl}:${sprite.impactSoundUrl ?? ""}`;
    const cached = imageCacheRef.current.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const spriteImage = await loadOverlayImage(sprite.spriteSheetUrl);
      const glass = await loadOverlayImage(sprite.glassSmashUrl).catch(() => loadOverlayImage(defaultSheepThrowSprite.glassSmashUrl));
      const images = { glass, sprite, spriteImage };

      imageCacheRef.current.set(cacheKey, images);
      return images;
    } catch {
      throw new Error(`${sprite.label} throw sprite could not load.`);
    }
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const drawFrame = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      const images = imageRef.current;
      const sheepThrow = activeThrowRef.current;

      if (!canvas || !context || !images || !sheepThrow) {
        animationFrameRef.current = null;
        return;
      }

      if (document.visibilityState === "hidden") {
        animationFrameRef.current = null;
        stopAnimation();
        return;
      }

      const elapsed = timestamp - startTimeRef.current;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, maxOverlayDevicePixelRatio);

      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const impactStarted = elapsed >= approachMs;
      const fadeStart = Math.max(approachMs, settingsRef.current.overlayDurationMs - fadeMs);
      const fadeProgress = elapsed > fadeStart ? Math.min(1, (elapsed - fadeStart) / fadeMs) : 0;
      const opacity = Math.max(0, 1 - fadeProgress);
      const seed = hashText(sheepThrow.id);
      const fromLeft = seed % 2 === 0;
      const progress = easeOutBack(Math.min(1, elapsed / approachMs));
      const targetX = width * 0.5;
      const targetY = height * 0.5;
      const startX = fromLeft ? -width * 0.12 : width * 1.12;
      const startY = height * (0.72 + (seed % 8) * 0.015);
      const x = startX + (targetX - startX) * progress;
      const y = startY + (targetY - startY) * progress;
      const maxSize = Math.min(width, height) * 0.56;
      const drawSize = Math.max(56, maxSize * (0.16 + progress * 0.84));
      const totalFrames = Math.max(1, Math.min(images.sprite.frameCount, images.sprite.columns * images.sprite.rows));
      const frameWidth = images.sprite.frameWidth;
      const frameHeight = images.sprite.frameHeight;
      const frameIndex = impactStarted ? totalFrames - 1 : Math.min(totalFrames - 1, Math.floor(elapsed / frameMs) % totalFrames);
      const frameColumn = frameIndex % images.sprite.columns;
      const frameRow = Math.floor(frameIndex / images.sprite.columns);
      const rotation = (fromLeft ? 1 : -1) * (0.9 - progress * 0.9) + Math.sin(elapsed / 95) * 0.08;

      if (impactStarted && !impactTriggeredRef.current) {
        impactTriggeredRef.current = true;
        setIncomingBlur(false);
        document.documentElement.classList.add("bc-sheep-impact-wobble");
        playImpactSound(images.sprite.impactSoundUrl);
        vibrateMobile(impactVibrationPattern, performancePreferencesRef.current.hapticsEnabled);

        if (wobbleTimeoutRef.current !== null) {
          window.clearTimeout(wobbleTimeoutRef.current);
        }

        wobbleTimeoutRef.current = window.setTimeout(() => {
          document.documentElement.classList.remove("bc-sheep-impact-wobble");
          wobbleTimeoutRef.current = null;
        }, impactShakeMs);
      }

      if (impactStarted && elapsed - approachMs < impactShakeMs) {
        const shakeAmount = 10 * (1 - (elapsed - approachMs) / impactShakeMs);
        context.translate(Math.sin(elapsed * 0.09) * shakeAmount, Math.cos(elapsed * 0.07) * shakeAmount);
      }

      if (impactStarted) {
        const glassSize = Math.min(width, height) * 0.74;

        context.save();
        context.globalAlpha = opacity * Math.min(1, (elapsed - approachMs) / 140);
        context.translate(targetX, targetY);
        context.rotate(((seed % 17) - 8) * 0.01);
        context.drawImage(images.glass, -glassSize / 2, -glassSize / 2, glassSize, glassSize);
        context.restore();
      }

      context.save();
      context.globalAlpha = opacity;
      context.translate(impactStarted ? targetX : x, impactStarted ? targetY : y);
      context.rotate(impactStarted ? 0 : rotation);
      context.drawImage(
        images.spriteImage,
        frameColumn * frameWidth,
        frameRow * frameHeight,
        frameWidth,
        frameHeight,
        -drawSize / 2,
        -drawSize / 2,
        drawSize,
        drawSize
      );
      context.restore();

      if (elapsed < settingsRef.current.overlayDurationMs) {
        animationFrameRef.current = window.requestAnimationFrame((nextTimestamp) => drawFrameRef.current(nextTimestamp));
      } else {
        stopAnimation();
      }
    },
    [playImpactSound, stopAnimation]
  );

  const drawStaticImpact = useCallback((images: LoadedImages) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return false;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, maxOverlayDevicePixelRatio);
    const targetX = width * 0.5;
    const targetY = height * 0.5;
    const drawSize = Math.max(56, Math.min(width, height) * 0.56);
    const glassSize = Math.min(width, height) * 0.74;
    const totalFrames = Math.max(1, Math.min(images.sprite.frameCount, images.sprite.columns * images.sprite.rows));
    const frameIndex = totalFrames - 1;
    const frameColumn = frameIndex % images.sprite.columns;
    const frameRow = Math.floor(frameIndex / images.sprite.columns);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalAlpha = 0.9;
    context.drawImage(images.glass, targetX - glassSize / 2, targetY - glassSize / 2, glassSize, glassSize);
    context.globalAlpha = 1;
    context.drawImage(
      images.spriteImage,
      frameColumn * images.sprite.frameWidth,
      frameRow * images.sprite.frameHeight,
      images.sprite.frameWidth,
      images.sprite.frameHeight,
      targetX - drawSize / 2,
      targetY - drawSize / 2,
      drawSize,
      drawSize
    );

    return true;
  }, []);

  const playNext = useCallback(() => {
    if (activeThrowRef.current) {
      return;
    }

    if (loadingThrowRef.current) {
      return;
    }

    const nextThrow = queueRef.current.shift();

    if (!nextThrow) {
      return;
    }

    loadingThrowRef.current = true;

    void loadImagesForSprite(nextThrow.sprite)
      .then((images) => {
        loadingThrowRef.current = false;
        imageRef.current = images;
        activeThrowRef.current = nextThrow;
        setActiveThrow(nextThrow);
        setVisualFallback(false);
        impactTriggeredRef.current = false;

        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (!reducedMotionEnabled(performancePreferencesRef.current)) {
          const startAnimationWhenCanvasReady = (attempt = 0) => {
            if (activeThrowRef.current?.id !== nextThrow.id) {
              animationFrameRef.current = null;
              return;
            }

            if (!canvasRef.current && attempt < 20) {
              animationFrameRef.current = window.requestAnimationFrame(() => startAnimationWhenCanvasReady(attempt + 1));
              return;
            }

            if (!canvasRef.current) {
              setIncomingBlur(false);
              timeoutRef.current = window.setTimeout(() => {
                timeoutRef.current = null;
                activeThrowRef.current = null;
                setActiveThrow(null);
                playNextRef.current();
              }, Math.min(2500, settingsRef.current.overlayDurationMs));
              return;
            }

            animationFrameRef.current = null;
            stopAnimation();
            setIncomingBlur(true);
            vibrateMobile(incomingVibrationPattern, performancePreferencesRef.current.hapticsEnabled);
            startTimeRef.current = performance.now();
            animationFrameRef.current = window.requestAnimationFrame((timestamp) => drawFrameRef.current(timestamp));
            timeoutRef.current = window.setTimeout(() => {
              timeoutRef.current = null;
              activeThrowRef.current = null;
              setActiveThrow(null);
              playNextRef.current();
            }, settingsRef.current.overlayDurationMs);
          };

          animationFrameRef.current = window.requestAnimationFrame(() => startAnimationWhenCanvasReady());
          return;
        }

        const showStaticImpactWhenCanvasReady = (attempt = 0) => {
          if (activeThrowRef.current?.id !== nextThrow.id) {
            return;
          }

          if (!drawStaticImpact(images) && attempt < 20) {
            animationFrameRef.current = window.requestAnimationFrame(() => showStaticImpactWhenCanvasReady(attempt + 1));
            return;
          }

          animationFrameRef.current = null;
          setIncomingBlur(false);
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            activeThrowRef.current = null;
            setActiveThrow(null);
            setVisualFallback(false);
            stopAnimation();
            playNextRef.current();
          }, Math.min(2500, settingsRef.current.overlayDurationMs));
        };

        animationFrameRef.current = window.requestAnimationFrame(() => showStaticImpactWhenCanvasReady());
      })
      .catch(() => {
        loadingThrowRef.current = false;
        activeThrowRef.current = nextThrow;
        setActiveThrow(nextThrow);
        setIncomingBlur(false);
        setVisualFallback(true);
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          activeThrowRef.current = null;
          setActiveThrow(null);
          setVisualFallback(false);
          playNextRef.current();
        }, Math.min(2500, settingsRef.current.overlayDurationMs));
      });
  }, [drawStaticImpact, loadImagesForSprite, stopAnimation]);

  const enqueueThrows = useCallback(
    (throws: ChatSheepThrowSummary[]) => {
      const newThrows = throws.filter((sheepThrow) => {
        if (seenIdsRef.current.has(sheepThrow.id)) {
          return false;
        }

        seenIdsRef.current.add(sheepThrow.id);
        return true;
      });

      if (!newThrows.length) {
        return;
      }

      persistSeenThrowIds(seenIdsRef.current);
      queueRef.current.push(...newThrows);
      playNext();
    },
    [playNext]
  );

  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    performancePreferencesRef.current = performancePreferences;

    if (!performancePreferences.animationsEnabled && activeThrowRef.current && imageRef.current) {
      const cleanupTimer = window.setTimeout(() => {
        setIncomingBlur(false);
        document.documentElement.classList.remove("bc-sheep-impact-wobble");
        stopAnimation();
        drawStaticImpact(imageRef.current as LoadedImages);
      }, 0);

      return () => window.clearTimeout(cleanupTimer);
    }
  }, [drawStaticImpact, performancePreferences, stopAnimation]);

  useEffect(() => {
    void loadImagesForSprite(defaultSheepThrowSprite).catch(() => {
      imageRef.current = null;
    });
  }, [loadImagesForSprite]);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch("/api/chat/sheep-throws", {
          cache: "no-store"
        });
        const payload = (await response.json()) as ChatSheepThrowOverlayData;

        if (!active || !response.ok) {
          return;
        }

        setSettings(payload.settings);

        if (!initializedRef.current) {
          readSeenThrowIds().forEach((id) => seenIdsRef.current.add(id));
          initializedRef.current = true;
        }

        if (!payload.settings.enabled) {
          queueRef.current = [];
          activeThrowRef.current = null;
          setActiveThrow(null);
          setVisualFallback(false);
          setIncomingBlur(false);
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          stopAnimation();
          return;
        }

        enqueueThrows(payload.recentThrows);
      } catch {
        // Keep the last successful sheep throw state if polling fails.
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, settings.pollMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        const interruptedIds = [activeThrowRef.current?.id, ...queueRef.current.map((sheepThrow) => sheepThrow.id)].filter(
          (id): id is string => Boolean(id)
        );

        interruptedIds.forEach((id) => seenIdsRef.current.delete(id));
        persistSeenThrowIds(seenIdsRef.current);
        queueRef.current = [];
        activeThrowRef.current = null;
        setActiveThrow(null);
        setVisualFallback(false);
        setIncomingBlur(false);

        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (wobbleTimeoutRef.current !== null) {
          window.clearTimeout(wobbleTimeoutRef.current);
          wobbleTimeoutRef.current = null;
        }

        document.documentElement.classList.remove("bc-sheep-impact-wobble");
        stopAnimation();
        return;
      }

      void refresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enqueueThrows, settings.pollMs, stopAnimation]);

  useEffect(
    () => () => {
      stopAnimation();

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (wobbleTimeoutRef.current !== null) {
        window.clearTimeout(wobbleTimeoutRef.current);
        wobbleTimeoutRef.current = null;
      }

      document.documentElement.classList.remove("bc-sheep-impact-wobble");
    },
    [stopAnimation]
  );

  if (!activeThrow) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-[72] overflow-hidden" data-sheep-throw-overlay>
      {incomingBlur ? <div className="bc-sheep-motion-blur absolute inset-0" aria-hidden="true" /> : null}
      <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
      {visualFallback ? (
        <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <span className="text-[clamp(6rem,28vmin,18rem)] drop-shadow-[0_18px_28px_rgba(0,0,0,0.7)]">
            {fallbackThrowableGlyph(activeThrow.sprite.label)}
          </span>
        </div>
      ) : null}
      <div className="absolute inset-x-3 top-[18dvh] flex justify-center">
        <div className="max-w-[min(34rem,92vw)] rounded-md border border-white/20 bg-bc-void/78 px-4 py-3 text-center shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-base font-black text-white sm:text-xl">{activeLabel}</p>
        </div>
      </div>
    </div>
  );
}
