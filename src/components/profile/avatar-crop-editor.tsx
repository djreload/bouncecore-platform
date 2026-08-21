"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Move, Trash2, Upload, UserRound, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const avatarOutputSize = 512;
const maxSelectedAvatarBytes = 25 * 1024 * 1024;
const recognizableImageExtensions = [".avif", ".bmp", ".gif", ".heic", ".heif", ".jfif", ".jpeg", ".jpg", ".png", ".webp"];

type AvatarCropEditorProps = {
  currentAvatarUrl: string | null;
  disabled?: boolean;
};

type CropSource = {
  height: number;
  name: string;
  url: string;
  width: number;
};

type Position = {
  x: number;
  y: number;
};

type CropMetrics = {
  baseScale: number;
  maxX: number;
  maxY: number;
  renderedHeight: number;
  renderedWidth: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cropMetrics(source: CropSource, viewportSize: number, zoom: number): CropMetrics {
  const baseScale = Math.max(viewportSize / source.width, viewportSize / source.height);
  const renderedWidth = source.width * baseScale * zoom;
  const renderedHeight = source.height * baseScale * zoom;

  return {
    baseScale,
    maxX: Math.max(0, (renderedWidth - viewportSize) / 2),
    maxY: Math.max(0, (renderedHeight - viewportSize) / 2),
    renderedHeight,
    renderedWidth
  };
}

function clampedPosition(position: Position, metrics: CropMetrics): Position {
  return {
    x: clamp(position.x, -metrics.maxX, metrics.maxX),
    y: clamp(position.y, -metrics.maxY, metrics.maxY)
  };
}

function sliderValue(value: number, maximum: number) {
  return maximum > 0 ? Math.round((value / maximum) * 100) : 0;
}

function positionFromSlider(value: string, maximum: number) {
  return (Number(value) / 100) * maximum;
}

function avatarUploadError(error: unknown) {
  return error instanceof Error ? error.message : "Profile picture could not be prepared.";
}

export function AvatarCropEditor({ currentAvatarUrl, disabled = false }: AvatarCropEditorProps) {
  const id = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosition: Position;
  } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [source, setSource] = useState<CropSource | null>(null);
  const [viewportSize, setViewportSize] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metrics = source ? cropMetrics(source, viewportSize, zoom) : null;
  const safePosition = metrics ? clampedPosition(position, metrics) : position;

  function releaseSourceUrl() {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    }
  }

  function closeEditor() {
    releaseSourceUrl();
    sourceImageRef.current = null;
    setSource(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    dragRef.current = null;
  }

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || !source) {
      return;
    }

    const measure = () => setViewportSize(Math.max(1, viewport.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [source]);

  useEffect(() => {
    return () => releaseSourceUrl();
  }, []);

  async function selectPhoto(file: File | null) {
    setError(null);
    setMessage(null);

    if (!file) {
      return;
    }

    const lowerName = file.name.toLowerCase();
    const recognizableExtension = recognizableImageExtensions.some((extension) => lowerName.endsWith(extension));

    if (!file.type.startsWith("image/") && !recognizableExtension) {
      setError("Choose an image from your device.");
      return;
    }

    if (file.size > maxSelectedAvatarBytes) {
      setError("That image is larger than 25MB. Choose a smaller original photo.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("This device could not read that image format."));
        image.src = objectUrl;
      });

      releaseSourceUrl();
      sourceUrlRef.current = objectUrl;
      sourceImageRef.current = image;
      setSource({
        height: image.naturalHeight,
        name: file.name,
        url: objectUrl,
        width: image.naturalWidth
      });
      setPosition({ x: 0, y: 0 });
      setZoom(1);
    } catch (selectionError) {
      URL.revokeObjectURL(objectUrl);
      setError(avatarUploadError(selectionError));
    }
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!source || busy) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: safePosition
    };
  }

  function dragPhoto(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId || !metrics) {
      return;
    }

    setPosition(
      clampedPosition(
        {
          x: drag.startPosition.x + event.clientX - drag.startClientX,
          y: drag.startPosition.y + event.clientY - drag.startClientY
        },
        metrics
      )
    );
  }

  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  async function applyCroppedPhoto() {
    const image = sourceImageRef.current;

    if (!source || !image || !metrics) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = avatarOutputSize;
      canvas.height = avatarOutputSize;
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        throw new Error("This browser could not open the profile picture editor.");
      }

      const outputRatio = avatarOutputSize / viewportSize;
      const drawScale = metrics.baseScale * zoom * outputRatio;
      const drawWidth = source.width * drawScale;
      const drawHeight = source.height * drawScale;
      context.fillStyle = "#070910";
      context.fillRect(0, 0, avatarOutputSize, avatarOutputSize);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        avatarOutputSize / 2 + safePosition.x * outputRatio - drawWidth / 2,
        avatarOutputSize / 2 + safePosition.y * outputRatio - drawHeight / 2,
        drawWidth,
        drawHeight
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("The cropped profile picture could not be created."))),
          "image/jpeg",
          0.9
        );
      });
      const formData = new FormData();
      formData.set("file", new File([blob], "profile-avatar.jpg", { type: "image/jpeg" }));
      const response = await fetch("/api/account/profile/avatar", {
        body: formData,
        cache: "no-store",
        credentials: "same-origin",
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Profile picture upload failed.");
      }

      setAvatarUrl(payload.url);
      setMessage("Photo ready. Save your profile to apply it everywhere.");
      closeEditor();
    } catch (uploadError) {
      setError(avatarUploadError(uploadError));
    } finally {
      setBusy(false);
    }
  }

  function removePhoto() {
    closeEditor();
    setAvatarUrl("");
    setError(null);
    setMessage("Profile picture will be removed when you save your profile.");
  }

  return (
    <div className="grid gap-4 rounded-md border border-bc-line bg-bc-ink p-4">
      <input name="avatarUrl" type="hidden" value={avatarUrl} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-bc-line bg-bc-panel">
          {avatarUrl ? (
            <Image alt="Current profile picture" className="h-full w-full object-cover" height={80} src={avatarUrl} unoptimized width={80} />
          ) : (
            <span className="grid h-full w-full place-items-center text-bc-muted">
              <UserRound className="h-8 w-8" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">Profile picture</p>
          <p className="mt-1 text-xs leading-5 text-bc-muted">Choose a photo, then drag and zoom it into the square frame.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={disabled || busy} onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="ghost">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose photo
            </Button>
            {avatarUrl ? (
              <Button disabled={disabled || busy} onClick={removePhoto} size="sm" type="button" variant="dark">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          <input
            accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.avif,.heic,.heif"
            className="sr-only"
            disabled={disabled || busy}
            id={`${id}-avatar-file`}
            onChange={(event) => {
              void selectPhoto(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </div>

      {source && metrics ? (
        <div className="grid gap-4 border-t border-bc-line pt-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
          <div
            aria-label="Drag the photo to reposition it"
            className="relative aspect-square w-full max-w-80 cursor-grab touch-none select-none overflow-hidden rounded-md border-2 border-bc-electric bg-bc-void active:cursor-grabbing"
            onPointerCancel={stopDrag}
            onPointerDown={startDrag}
            onPointerMove={dragPhoto}
            onPointerUp={stopDrag}
            ref={viewportRef}
            role="application"
          >
            <Image
              alt={`Crop preview for ${source.name}`}
              className="pointer-events-none absolute max-w-none select-none"
              draggable={false}
              height={source.height}
              src={source.url}
              style={{
                height: metrics.renderedHeight,
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${safePosition.x}px), calc(-50% + ${safePosition.y}px))`,
                width: metrics.renderedWidth
              }}
              unoptimized
              width={source.width}
            />
            <span className="pointer-events-none absolute inset-0 border-[24px] border-black/20" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
          </div>

          <div className="grid content-start gap-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase text-bc-muted" htmlFor={`${id}-avatar-zoom`}>
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
                Zoom
              </label>
              <input
                className="mt-2 w-full accent-bc-electric"
                disabled={busy}
                id={`${id}-avatar-zoom`}
                max="3"
                min="1"
                onChange={(event) => setZoom(Number(event.target.value))}
                step="0.01"
                type="range"
                value={zoom}
              />
              <p className="mt-1 text-xs text-bc-muted">Zoom in until the important part fills the frame.</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase text-bc-muted" htmlFor={`${id}-avatar-horizontal`}>
                <Move className="h-4 w-4" aria-hidden="true" />
                Horizontal position
              </label>
              <input
                className="mt-2 w-full accent-bc-electric"
                disabled={busy || metrics.maxX === 0}
                id={`${id}-avatar-horizontal`}
                max="100"
                min="-100"
                onChange={(event) => setPosition((current) => ({ ...current, x: positionFromSlider(event.target.value, metrics.maxX) }))}
                step="1"
                type="range"
                value={sliderValue(safePosition.x, metrics.maxX)}
              />
              <p className="mt-1 text-xs text-bc-muted">Move the photo left or right inside the profile frame.</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase text-bc-muted" htmlFor={`${id}-avatar-vertical`}>
                <Move className="h-4 w-4 rotate-90" aria-hidden="true" />
                Vertical position
              </label>
              <input
                className="mt-2 w-full accent-bc-electric"
                disabled={busy || metrics.maxY === 0}
                id={`${id}-avatar-vertical`}
                max="100"
                min="-100"
                onChange={(event) => setPosition((current) => ({ ...current, y: positionFromSlider(event.target.value, metrics.maxY) }))}
                step="1"
                type="range"
                value={sliderValue(safePosition.y, metrics.maxY)}
              />
              <p className="mt-1 text-xs text-bc-muted">Move the photo up or down inside the profile frame.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void applyCroppedPhoto()} size="sm" type="button" variant="primary">
                <Check className="h-4 w-4" aria-hidden="true" />
                {busy ? "Uploading" : "Use this photo"}
              </Button>
              <Button disabled={busy} onClick={closeEditor} size="sm" type="button" variant="dark">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">{error}</p> : null}
      {message ? <p className="rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3 text-sm text-bc-acid">{message}</p> : null}

      <details className="border-t border-bc-line pt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-bc-muted">Use an image URL instead</summary>
        <label className="mt-3 block text-xs font-semibold uppercase text-bc-muted" htmlFor={`${id}-avatar-url`}>
          Profile image URL
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
          disabled={disabled || busy}
          id={`${id}-avatar-url`}
          onChange={(event) => {
            closeEditor();
            setAvatarUrl(event.target.value);
            setMessage(null);
            setError(null);
          }}
          placeholder="https://..."
          inputMode="url"
          type="text"
          value={avatarUrl}
        />
        <p className="mt-2 text-xs text-bc-muted">Paste a direct HTTPS image URL, then save the profile.</p>
      </details>
    </div>
  );
}
