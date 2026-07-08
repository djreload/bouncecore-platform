"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatSheepThrowOverlayData, ChatSheepThrowSummary } from "@/lib/chat/sheep-throw-service";
import { defaultSheepThrowSettings, defaultSheepThrowSprite, type SheepThrowSettings, type SheepThrowSprite } from "@/lib/chat/sheep-throw-settings";

type LoadedImages = {
  glass: HTMLImageElement;
  sprite: SheepThrowSprite;
  spriteImage: HTMLImageElement;
};

const approachMs = 1150;
const frameMs = 38;
const impactShakeMs = 650;
const fadeMs = 520;

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

function throwLabel(sheepThrow: ChatSheepThrowSummary) {
  const spriteLabel = sheepThrow.sprite.label.toLowerCase();
  const article = /^(uni|user|use|euro)/.test(spriteLabel) ? "a" : /^[aeiou]/.test(spriteLabel) ? "an" : "a";

  return sheepThrow.targetDisplayName
    ? `${sheepThrow.throwerDisplayName} threw ${article} ${spriteLabel} at ${sheepThrow.targetDisplayName}`
    : `${sheepThrow.throwerDisplayName} threw ${article} ${spriteLabel}`;
}

function reducedMotionEnabled() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SheepThrowOverlay() {
  const [activeThrow, setActiveThrow] = useState<ChatSheepThrowSummary | null>(null);
  const [incomingBlur, setIncomingBlur] = useState(false);
  const [settings, setSettings] = useState<SheepThrowSettings>(defaultSheepThrowSettings);
  const activeThrowRef = useRef<ChatSheepThrowSummary | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializedRef = useRef(false);
  const imageRef = useRef<LoadedImages | null>(null);
  const imageCacheRef = useRef(new Map<string, LoadedImages>());
  const drawFrameRef = useRef<(timestamp: number) => void>(() => undefined);
  const playNextRef = useRef<() => void>(() => undefined);
  const queueRef = useRef<ChatSheepThrowSummary[]>([]);
  const seenIdsRef = useRef(new Set<string>());
  const settingsRef = useRef(settings);
  const startTimeRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const impactTriggeredRef = useRef(false);
  const loadingThrowRef = useRef(false);
  const wobbleTimeoutRef = useRef<number | null>(null);
  const activeLabel = useMemo(() => (activeThrow ? throwLabel(activeThrow) : ""), [activeThrow]);

  const loadImagesForSprite = useCallback(async (sprite: SheepThrowSprite): Promise<LoadedImages> => {
    const cacheKey = `${sprite.id}:${sprite.spriteSheetUrl}:${sprite.glassSmashUrl}`;
    const cached = imageCacheRef.current.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const [spriteImage, glass] = await Promise.all([loadOverlayImage(sprite.spriteSheetUrl), loadOverlayImage(sprite.glassSmashUrl)]);
      const images = { glass, sprite, spriteImage };

      imageCacheRef.current.set(cacheKey, images);
      return images;
    } catch {
      if (sprite.id === defaultSheepThrowSprite.id) {
        throw new Error("Default throw sprite could not load.");
      }

      const fallbackCacheKey = `${defaultSheepThrowSprite.id}:${defaultSheepThrowSprite.spriteSheetUrl}:${defaultSheepThrowSprite.glassSmashUrl}`;
      const cachedFallback = imageCacheRef.current.get(fallbackCacheKey);

      if (cachedFallback) {
        return cachedFallback;
      }

      const [spriteImage, glass] = await Promise.all([
        loadOverlayImage(defaultSheepThrowSprite.spriteSheetUrl),
        loadOverlayImage(defaultSheepThrowSprite.glassSmashUrl)
      ]);
      const fallbackImages = { glass, sprite: defaultSheepThrowSprite, spriteImage };

      imageCacheRef.current.set(fallbackCacheKey, fallbackImages);
      return fallbackImages;
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

      const elapsed = timestamp - startTimeRef.current;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = window.devicePixelRatio || 1;

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
    [stopAnimation]
  );

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
        impactTriggeredRef.current = false;

        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (!reducedMotionEnabled()) {
          stopAnimation();
          setIncomingBlur(true);
          startTimeRef.current = performance.now();
          animationFrameRef.current = window.requestAnimationFrame((timestamp) => drawFrameRef.current(timestamp));
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            activeThrowRef.current = null;
            setActiveThrow(null);
            playNextRef.current();
          }, settingsRef.current.overlayDurationMs);
          return;
        }

        setIncomingBlur(false);
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          activeThrowRef.current = null;
          setActiveThrow(null);
          playNextRef.current();
        }, Math.min(2500, settingsRef.current.overlayDurationMs));
      })
      .catch(() => {
        loadingThrowRef.current = false;
        playNextRef.current();
      });
  }, [loadImagesForSprite, stopAnimation]);

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
    void loadImagesForSprite(defaultSheepThrowSprite).catch(() => {
      imageRef.current = null;
    });
  }, [loadImagesForSprite]);

  useEffect(() => {
    let active = true;

    async function refresh() {
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
          payload.recentThrows.forEach((sheepThrow) => seenIdsRef.current.add(sheepThrow.id));
          initializedRef.current = true;
          return;
        }

        if (!payload.settings.enabled) {
          queueRef.current = [];
          activeThrowRef.current = null;
          setActiveThrow(null);
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

    return () => {
      active = false;
      window.clearInterval(interval);
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
      <div className="absolute inset-x-3 top-[18dvh] flex justify-center">
        <div className="max-w-[min(34rem,92vw)] rounded-md border border-white/20 bg-bc-void/78 px-4 py-3 text-center shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-base font-black text-white sm:text-xl">{activeLabel}</p>
        </div>
      </div>
    </div>
  );
}
