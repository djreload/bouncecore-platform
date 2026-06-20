"use client";

import { Fragment, type CSSProperties } from "react";
import { getChatEffectById } from "@/lib/chat/chat-effects";
import { splitTextMentions, type ChatMentionSegment } from "@/lib/chat/mentions";
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

export function ChatEffectText({ body, className, effectId }: ChatEffectTextProps) {
  const effect = getChatEffectById(effectId);
  const segments = splitTextMentions(body);
  const letterOffset = { value: 0 };
  const renderLetters = effect?.renderMode === "letters";

  return (
    <p
      className={cn("mt-2 whitespace-pre-wrap break-words text-sm text-white", effect ? ["bc-chat-effect", effect.className] : null, className)}
      data-chat-effect={effect?.id}
    >
      {segments.map((segment, index) => renderMentionSegment(segment, `${index}-${segment.text}`, renderLetters, letterOffset))}
    </p>
  );
}
