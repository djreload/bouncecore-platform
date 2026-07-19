export const directMessageMaxLength = 2_000;
export const directMessageSendIntervalMs = 900;

export function directConversationPair(firstUserId: string, secondUserId: string) {
  const first = firstUserId.trim();
  const second = secondUserId.trim();

  if (!first || !second || first === second) {
    throw new Error("Choose another active user for this conversation.");
  }

  const [userOneId, userTwoId] = [first, second].sort();

  return {
    pairKey: `${userOneId}:${userTwoId}`,
    userOneId,
    userTwoId
  };
}

export function normalizeDirectMessageBody(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const body = value.replace(/\r\n?/g, "\n").trim();

  if (body.length > directMessageMaxLength) {
    throw new Error(`Private messages can contain up to ${directMessageMaxLength.toLocaleString("en-GB")} characters.`);
  }

  return body;
}

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

export function directMessageActionUrl(conversationId: string, messageId: string) {
  return `/account/messages?conversation=${encodeURIComponent(conversationId)}#direct-message-${encodeURIComponent(messageId)}`;
}

export function directMessageNotificationContent(input: {
  body: string;
  kind: string;
  senderDisplayName: string;
}) {
  const sender = compactText(input.senderDisplayName, 48) || "Someone";
  const fallback = input.kind === "attachment-image" ? "Sent you an image." : input.kind === "attachment-file" ? "Sent you a ZIP file." : "Sent you a message.";

  return {
    body: compactText(input.body, 160) || fallback,
    title: `${sender} sent you a private message`,
    type: "chat.direct_message"
  };
}
