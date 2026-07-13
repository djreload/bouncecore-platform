import type { RaveWarLevel } from "@/lib/rave-wars/levels/bazooka-battlefield";

export const raveWarStatuses = ["pending", "active", "declined", "cancelled", "expired", "finished"] as const;

export type RaveWarStatus = (typeof raveWarStatuses)[number];

export const raveWarWeaponIds = [
  "bazooka",
  "grenade",
  "shotgun",
  "bass-bomb",
  "glow-grenade",
  "sheep-launcher",
  "tnt-barrel",
  "stink-sock"
] as const;

export type RaveWarWeaponId = (typeof raveWarWeaponIds)[number];

export type RaveWarWeaponAmmo = Record<RaveWarWeaponId, number>;

export type RaveWarPlayerState = {
  angle: number;
  color: string;
  displayName: string;
  facing: "left" | "right";
  health: number;
  movementLeft: number;
  playerIndex: number;
  power: number;
  selectedWeapon: RaveWarWeaponId;
  userId: string;
  weaponAmmo: RaveWarWeaponAmmo;
  x: number;
  y: number;
};

export type RaveWarShotPoint = {
  x: number;
  y: number;
};

export type RaveWarTerrainCrater = {
  radius: number;
  x: number;
  y: number;
};

export type RaveWarLastShot = {
  angle: number;
  blastRadius: number;
  crater: RaveWarTerrainCrater | null;
  damage: number;
  distance: number;
  firedAt: string;
  impactKind: "terrain" | "hog" | "out-of-bounds";
  impactPoint: RaveWarShotPoint;
  path: RaveWarShotPoint[];
  power: number;
  shooterUserId: string;
  targetUserId: string;
  weaponId: RaveWarWeaponId;
};

export type RaveWarState = {
  activeUserId: string | null;
  craters: RaveWarTerrainCrater[];
  lastShot: RaveWarLastShot | null;
  levelKey: string;
  log: string[];
  players: RaveWarPlayerState[];
  turnEndsAt: string | null;
  turnNumber: number;
  turnStartedAt: string | null;
  version: 1;
  warEndsAt: string | null;
  winnerUserId: string | null;
};

export type RaveWarParticipantSummary = {
  acceptedAt: string | null;
  displayName: string;
  playerIndex: number;
  userId: string;
};

export type RaveWarSummary = {
  acceptedAt: string | null;
  challengerId: string;
  createdAt: string;
  currentUserRole: "challenger" | "target" | "spectator";
  endedAt: string | null;
  expiresAt: string;
  id: string;
  level: RaveWarLevel;
  participants: RaveWarParticipantSummary[];
  roomId: string;
  roomName: string;
  roomSlug: string;
  startedAt: string | null;
  state: RaveWarState;
  status: RaveWarStatus;
  targetId: string;
  turnUserId: string | null;
  winnerUserId: string | null;
};

export type RaveWarChallengeSummary = {
  challengerDisplayName: string;
  createdAt: string;
  currentUserRole: "challenger" | "target";
  expiresAt: string;
  id: string;
  levelName: string;
  roomSlug: string;
  status: RaveWarStatus;
  targetDisplayName: string;
};
