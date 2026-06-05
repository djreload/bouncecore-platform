export const starAlertScopes = ["live_only", "public_site"] as const;
export const starAlertEffectModes = ["amount_based", "floating_stars", "confetti", "fireworks"] as const;

export type StarAlertScope = (typeof starAlertScopes)[number];
export type StarAlertEffectMode = (typeof starAlertEffectModes)[number];

export type StarAlertSettings = {
  enabled: boolean;
  scope: StarAlertScope;
  effectMode: StarAlertEffectMode;
  durationMs: number;
  pollMs: number;
  confettiMinimumStars: number;
  fireworksMinimumStars: number;
};

export const defaultStarAlertSettings: StarAlertSettings = {
  enabled: true,
  scope: "public_site",
  effectMode: "amount_based",
  durationMs: 5200,
  pollMs: 2000,
  confettiMinimumStars: 100,
  fireworksMinimumStars: 250
};
