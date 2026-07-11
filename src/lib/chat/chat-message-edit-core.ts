export const chatMessageBodyMaxLength = 500;

export function normalizeEditableChatMessageBody(body: string) {
  const normalizedBody = body.replace(/\r\n?/g, "\n").trim();

  if (normalizedBody.length < 1 || normalizedBody.length > chatMessageBodyMaxLength) {
    throw new Error(`Chat messages must be between 1 and ${chatMessageBodyMaxLength} characters.`);
  }

  return normalizedBody;
}

export function canEditChatMessage(input: {
  authorUserId: string | null;
  currentUserId: string | null | undefined;
  deletedAt: Date | string | null;
  kind: string;
}) {
  return Boolean(input.currentUserId && input.authorUserId === input.currentUserId && input.kind === "text" && !input.deletedAt);
}
