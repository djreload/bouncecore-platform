export const chatMentionNotificationType = "chat.mention";

export type ChatMentionUserMatchInput = {
  displayName: string;
  profileSlug?: string | null;
};

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizeNotificationMentionToken(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .slice(0, 32)
    .toLowerCase();
}

function notificationMentionTokenFromDisplayName(value: string) {
  return (
    value
      .normalize("NFKC")
      .trim()
      .replace(/^@+/, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "")
      .slice(0, 32) || "user"
  );
}

export function chatMentionActionUrl(input: { messageId: string; roomSlug: string }) {
  const room = encodeURIComponent(input.roomSlug);
  const message = encodeURIComponent(input.messageId);

  return `/chat?room=${room}#chat-message-${message}`;
}

export function chatMentionDedupeKey(input: { messageId: string; userId: string }) {
  return `${chatMentionNotificationType}:${input.messageId}:user:${input.userId}`;
}

export function chatMentionNotificationContent(input: { authorDisplayName: string; body: string; roomSlug: string }) {
  const author = compactText(input.authorDisplayName, 48) || "Someone";
  const room = compactText(input.roomSlug, 48) || "chat";

  return {
    body: compactText(input.body, 160),
    title: `${author} mentioned you in #${room}`,
    type: chatMentionNotificationType
  };
}

export function chatMentionTokensForUser(user: ChatMentionUserMatchInput) {
  return [
    normalizeNotificationMentionToken(notificationMentionTokenFromDisplayName(user.displayName)),
    user.profileSlug ? normalizeNotificationMentionToken(user.profileSlug) : ""
  ].filter(Boolean);
}

export function userMatchesChatMention(tokens: readonly string[], user: ChatMentionUserMatchInput) {
  const tokenSet = new Set(tokens.map(normalizeNotificationMentionToken).filter(Boolean));

  if (!tokenSet.size) {
    return false;
  }

  return chatMentionTokensForUser(user).some((token) => tokenSet.has(token));
}
