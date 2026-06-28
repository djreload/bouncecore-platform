export const chatSheepThrowNotificationType = "chat.sheep_throw";

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

export function chatSheepThrowActionUrl(input: { messageId: string; roomSlug: string }) {
  const room = encodeURIComponent(input.roomSlug);
  const message = encodeURIComponent(input.messageId);

  return `/chat?room=${room}#chat-message-${message}`;
}

export function chatSheepThrowDedupeKey(input: { sheepThrowId: string; userId: string }) {
  return `${chatSheepThrowNotificationType}:${input.sheepThrowId}:user:${input.userId}`;
}

export function chatSheepThrowNotificationContent(input: { roomSlug: string; throwerDisplayName: string }) {
  const thrower = compactText(input.throwerDisplayName, 48) || "Someone";
  const room = compactText(input.roomSlug, 48) || "chat";

  return {
    body: `Open #${room} to jump back into the chat.`,
    title: `${thrower} threw a sheep at you 😂`,
    type: chatSheepThrowNotificationType
  };
}
