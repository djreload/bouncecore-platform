import type { RaveWarPlayerState } from "@/lib/rave-wars/rave-war-types";

export function raveWarDeadlineHasPassed(deadline: string | null, now = new Date()) {
  if (!deadline) {
    return false;
  }

  const deadlineMs = new Date(deadline).getTime();

  return Number.isFinite(deadlineMs) && deadlineMs <= now.getTime();
}

export function nextLivingRaveWarPlayer(players: RaveWarPlayerState[], currentUserId: string | null) {
  const currentIndex = players.findIndex((player) => player.userId === currentUserId);
  const ordered = players.slice(currentIndex + 1).concat(players.slice(0, Math.max(0, currentIndex + 1)));

  return ordered.find((player) => player.health > 0) ?? players.find((player) => player.health > 0) ?? null;
}
