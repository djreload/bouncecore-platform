export type ChatMentionSegment =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "mention";
      normalized: string;
      text: string;
    };

const mentionPattern = /@([\p{L}\p{N}][\p{L}\p{N}_-]{0,31})/gu;
const activeMentionPattern = /(?:^|[\s([{])@([\p{L}\p{N}_-]{0,31})$/u;

export function normalizeMentionToken(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .slice(0, 32)
    .toLowerCase();
}

export function mentionTokenFromDisplayName(value: string) {
  return (
    value
      .normalize("NFKC")
      .trim()
      .replace(/^@+/, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "")
      .slice(0, 32) || "user"
  );
}

function canStartMention(text: string, index: number) {
  if (index === 0) {
    return true;
  }

  return !/[\p{L}\p{N}_-]/u.test(text[index - 1] ?? "");
}

export function splitTextMentions(text: string): ChatMentionSegment[] {
  const segments: ChatMentionSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(mentionPattern)) {
    const index = match.index ?? 0;
    const token = match[1] ?? "";

    if (!canStartMention(text, index)) {
      continue;
    }

    if (index > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, index) });
    }

    segments.push({
      kind: "mention",
      normalized: normalizeMentionToken(token),
      text: match[0]
    });
    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments.length ? segments : [{ kind: "text", text }];
}

export function extractMentionTokens(text: string) {
  return [
    ...new Set(
      splitTextMentions(text)
        .filter((segment): segment is Extract<ChatMentionSegment, { kind: "mention" }> => segment.kind === "mention")
        .map((segment) => segment.normalized)
        .filter(Boolean)
    )
  ];
}

export function getActiveMentionQuery(text: string, caretIndex: number) {
  const beforeCaret = text.slice(0, Math.max(0, caretIndex));
  const match = beforeCaret.match(activeMentionPattern);

  return match ? match[1] : null;
}

export function replaceActiveMention(text: string, caretIndex: number, displayName: string) {
  const beforeCaret = text.slice(0, Math.max(0, caretIndex));
  const afterCaret = text.slice(Math.max(0, caretIndex));
  const match = beforeCaret.match(activeMentionPattern);

  if (!match || match.index === undefined) {
    return {
      caretIndex,
      text
    };
  }

  const token = mentionTokenFromDisplayName(displayName);
  const prefix = beforeCaret.slice(0, match.index);
  const boundary = match[0].startsWith("@") ? "" : match[0].charAt(0);
  const replacement = `${boundary}@${token} `;
  const nextText = `${prefix}${replacement}${afterCaret}`;

  return {
    caretIndex: prefix.length + replacement.length,
    text: nextText
  };
}
