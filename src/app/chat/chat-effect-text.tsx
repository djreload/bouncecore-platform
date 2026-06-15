"use client";

import type { CSSProperties } from "react";
import { getChatEffectById } from "@/lib/chat/chat-effects";
import { cn } from "@/lib/utils";

type ChatEffectTextProps = {
  body: string;
  effectId?: string | null;
  className?: string;
};

function letterStyle(index: number) {
  return {
    "--bc-chat-effect-index": index % 32
  } as CSSProperties;
}

export function ChatEffectText({ body, className, effectId }: ChatEffectTextProps) {
  const effect = getChatEffectById(effectId);

  return (
    <p
      className={cn("mt-2 whitespace-pre-wrap break-words text-sm text-white", effect ? ["bc-chat-effect", effect.className] : null, className)}
      data-chat-effect={effect?.id}
    >
      {effect?.renderMode === "letters"
        ? Array.from(body).map((character, index) => (
            <span className="bc-chat-effect-letter" key={`${character}-${index}`} style={letterStyle(index)}>
              {character}
            </span>
          ))
        : body}
    </p>
  );
}
