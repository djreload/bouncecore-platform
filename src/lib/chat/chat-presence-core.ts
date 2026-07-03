export const chatPresenceOnlineMs = 5 * 60 * 1000;
export const chatPresenceAwayMs = 30 * 60 * 1000;

export type ChatPresenceStatus = "online" | "away";

export function chatPresenceStatus(lastActiveAt: Date | string, now = new Date()): ChatPresenceStatus {
  const lastActiveTime = lastActiveAt instanceof Date ? lastActiveAt.getTime() : new Date(lastActiveAt).getTime();

  if (!Number.isFinite(lastActiveTime)) {
    return "away";
  }

  return now.getTime() - lastActiveTime <= chatPresenceOnlineMs ? "online" : "away";
}

export function isChatPresenceOnline(lastActiveAt: Date | string, now = new Date()) {
  return chatPresenceStatus(lastActiveAt, now) === "online";
}
