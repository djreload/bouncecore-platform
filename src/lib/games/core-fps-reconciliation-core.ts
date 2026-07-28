export const coreFpsSessionPresenceWindowMs = 90_000;
export const coreFpsSessionLaunchGraceWindowMs = 5 * 60_000;
export const coreFpsResultBackfillWindowMs = 10 * 60_000;

export type CoreFpsResultLeader = {
  damage: number;
  deaths: number;
  displayName: string;
  flags: number;
  frags: number;
  score: number;
  userId: string;
};

export function coreFpsLifecycleCutoffs(now = new Date()) {
  return {
    activeSession: new Date(now.getTime() - coreFpsSessionPresenceWindowMs),
    launchedSession: new Date(now.getTime() - coreFpsSessionLaunchGraceWindowMs),
    resultBackfill: new Date(now.getTime() - coreFpsResultBackfillWindowMs)
  };
}

export function buildCoreFpsResultBody(input: {
  leader: CoreFpsResultLeader;
  mapName: string;
  modeName?: string;
  playerCount: number;
}) {
  const mapName = input.mapName.trim() || "the selected map";
  const modeName = input.modeName
    ? `${coreFpsModeDefinition(input.modeName).displayName} `
    : "";
  const playerLabel = input.playerCount === 1 ? "player" : "players";
  const fragLabel = input.leader.frags === 1 ? "frag" : "frags";

  return `Core FPS ${modeName}on ${mapName} finished with ${input.playerCount} ${playerLabel}. ${input.leader.displayName} led the match with ${input.leader.score.toLocaleString("en-GB")} points and ${input.leader.frags.toLocaleString("en-GB")} ${fragLabel}.`;
}
import { coreFpsModeDefinition } from "@/lib/games/core-fps-lobby-core";
