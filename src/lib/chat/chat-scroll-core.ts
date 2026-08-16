export const chatFollowLatestThresholdPx = 96;

export type ChatScrollMetrics = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

export function chatDistanceFromBottom(metrics: ChatScrollMetrics) {
  return Math.max(0, metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight);
}

export function shouldFollowLatestChatMessage(
  metrics: ChatScrollMetrics,
  thresholdPx = chatFollowLatestThresholdPx
) {
  return chatDistanceFromBottom(metrics) <= Math.max(0, thresholdPx);
}

export function countNewChatMessageIds(knownIds: ReadonlySet<string>, messageIds: readonly string[]) {
  return messageIds.reduce((count, messageId) => count + (knownIds.has(messageId) ? 0 : 1), 0);
}
