"use client";

import { Fragment, type CSSProperties } from "react";
import { getChatEffectById, type ChatEffectParticlePreset } from "@/lib/chat/chat-effects";
import { splitTextMentions, type ChatMentionSegment } from "@/lib/chat/mentions";
import { cn } from "@/lib/utils";

type ChatEffectTextProps = {
  animationsEnabled?: boolean;
  body: string;
  effectId?: string | null;
  className?: string;
  particlesEnabled?: boolean;
};

function letterStyle(index: number) {
  return {
    "--bc-chat-effect-index": index % 32
  } as CSSProperties;
}

const particleSlots = [
  { delay: -0.2, drift: -10, duration: 2.9, scale: 0.7, x: 8, y: 64 },
  { delay: -1.3, drift: 12, duration: 3.4, scale: 0.9, x: 18, y: 38 },
  { delay: -0.8, drift: -4, duration: 3.1, scale: 0.55, x: 29, y: 72 },
  { delay: -2.1, drift: 9, duration: 3.7, scale: 0.78, x: 42, y: 30 },
  { delay: -1.7, drift: -13, duration: 3.2, scale: 1, x: 53, y: 80 },
  { delay: -0.5, drift: 7, duration: 2.8, scale: 0.62, x: 64, y: 42 },
  { delay: -2.6, drift: -8, duration: 3.9, scale: 0.84, x: 75, y: 68 },
  { delay: -1.0, drift: 14, duration: 3.3, scale: 0.72, x: 88, y: 36 },
  { delay: -2.9, drift: -6, duration: 4.1, scale: 0.58, x: 96, y: 74 },
  { delay: -1.9, drift: 5, duration: 3.6, scale: 0.96, x: 4, y: 28 }
] as const;

function particleStyle(slot: (typeof particleSlots)[number]) {
  return {
    "--bc-chat-particle-delay": `${slot.delay}s`,
    "--bc-chat-particle-drift": `${slot.drift}px`,
    "--bc-chat-particle-duration": `${slot.duration}s`,
    "--bc-chat-particle-scale": slot.scale,
    "--bc-chat-particle-x": `${slot.x}%`,
    "--bc-chat-particle-y": `${slot.y}%`
  } as CSSProperties;
}

function particleGlyph(preset: ChatEffectParticlePreset) {
  if (preset === "stars") {
    return "✦";
  }

  if (preset === "hearts") {
    return "♥";
  }

  if (preset === "matrix") {
    return "01";
  }

  if (preset === "crowns") {
    return "♛";
  }

  return "";
}

function ChatEffectParticles({ preset }: { preset: ChatEffectParticlePreset }) {
  const glyph = particleGlyph(preset);

  return (
    <span aria-hidden="true" className={`bc-chat-effect-particles bc-chat-effect-particles-${preset}`}>
      {particleSlots.map((slot, index) => (
        <span className="bc-chat-effect-particle" key={index} style={particleStyle(slot)}>
          {glyph}
        </span>
      ))}
    </span>
  );
}

function renderMentionSegment(segment: ChatMentionSegment, key: string, renderLetters: boolean, letterOffset: { value: number }) {
  const content = renderLetters
    ? Array.from(segment.text).map((character) => {
        const index = letterOffset.value;
        letterOffset.value += 1;

        return (
          <span className="bc-chat-effect-letter" key={`${key}-${index}`} style={letterStyle(index)}>
            {character}
          </span>
        );
      })
    : segment.text;

  if (segment.kind !== "mention") {
    return <Fragment key={key}>{content}</Fragment>;
  }

  return (
    <span className="bc-chat-mention" data-mention={segment.normalized} key={key}>
      {content}
    </span>
  );
}

export function ChatEffectText({
  animationsEnabled = true,
  body,
  className,
  effectId,
  particlesEnabled = true
}: ChatEffectTextProps) {
  const effect = getChatEffectById(effectId);
  const segments = splitTextMentions(body);
  const letterOffset = { value: 0 };
  const renderLetters = effect?.renderMode === "letters";

  return (
    <p
      className={cn(
        "mt-2 whitespace-pre-wrap break-words text-sm text-white",
        effect ? ["bc-chat-effect", effect.className] : null,
        className
      )}
      data-chat-animations={animationsEnabled ? "on" : "reduced"}
      data-chat-effect={effect?.id}
      data-chat-particles={effect?.particlePreset}
    >
      {segments.map((segment, index) => renderMentionSegment(segment, `${index}-${segment.text}`, renderLetters, letterOffset))}
      {animationsEnabled && particlesEnabled && effect?.particlePreset ? <ChatEffectParticles preset={effect.particlePreset} /> : null}
    </p>
  );
}
