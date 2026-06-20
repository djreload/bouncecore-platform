import type { Role } from "@/lib/auth/rbac";

export const chatEffectGroups = ["free", "supporter", "staff", "developer", "owner"] as const;
export const chatEffectRequiredRoles = ["viewer", "supporter", "moderator", "developer", "owner"] as const;
export const chatEffectParticlePresets = [
  "sparkles",
  "stars",
  "fire",
  "ice",
  "hearts",
  "storm",
  "matrix",
  "crowns"
] as const;

export type ChatEffectGroup = (typeof chatEffectGroups)[number];
export type ChatEffectRequiredRole = (typeof chatEffectRequiredRoles)[number];
export type ChatEffectParticlePreset = (typeof chatEffectParticlePresets)[number];

export type ChatEffectDefinition = {
  id: string;
  displayName: string;
  group: ChatEffectGroup;
  requiredRole: ChatEffectRequiredRole;
  isHidden: boolean;
  className: string;
  description: string;
  particlePreset?: ChatEffectParticlePreset;
  renderMode?: "text" | "letters";
};

export const chatEffects = [
  {
    id: "glow",
    displayName: "Glow",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-glow",
    description: "Soft electric glow for readable highlighted messages.",
    particlePreset: "sparkles"
  },
  {
    id: "bounce",
    displayName: "Bounce",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-bounce",
    description: "A small vertical bounce that avoids changing line height."
  },
  {
    id: "wave",
    displayName: "Wave",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-wave",
    description: "Letters ripple gently across the message.",
    renderMode: "letters"
  },
  {
    id: "pulse",
    displayName: "Pulse",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-pulse",
    description: "Low-intensity pulse for short emphasis."
  },
  {
    id: "rainbow",
    displayName: "Rainbow",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-rainbow",
    description: "Moving rainbow gradient text.",
    particlePreset: "stars"
  },
  {
    id: "float",
    displayName: "Float",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-float",
    description: "Slow floating motion with stable layout."
  },
  {
    id: "shine",
    displayName: "Shine",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-shine",
    description: "Light sweep across the message text."
  },
  {
    id: "spark",
    displayName: "Spark",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-spark",
    description: "Small sparkling text-shadow flicker.",
    particlePreset: "stars"
  },
  {
    id: "shadow",
    displayName: "Shadow",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-shadow",
    description: "Animated drop-shadow depth."
  },
  {
    id: "typing",
    displayName: "Typing",
    group: "free",
    requiredRole: "viewer",
    isHidden: false,
    className: "bc-chat-effect-typing",
    description: "Subtle sequential letter reveal loop.",
    renderMode: "letters"
  },
  {
    id: "neon",
    displayName: "Neon",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-neon",
    description: "Bright supporter neon with cyan and pink edges.",
    particlePreset: "sparkles"
  },
  {
    id: "gold",
    displayName: "Gold",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-gold",
    description: "Animated gold premium finish.",
    particlePreset: "stars"
  },
  {
    id: "fire",
    displayName: "Fire",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-fire",
    description: "Warm fire glow with rising ember particles.",
    particlePreset: "fire"
  },
  {
    id: "ice",
    displayName: "Ice",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-ice",
    description: "Cool frosted shimmer with drifting ice particles.",
    particlePreset: "ice"
  },
  {
    id: "heartbeat",
    displayName: "Heartbeat",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-heartbeat",
    description: "Short heartbeat scale pulse with floating hearts.",
    particlePreset: "hearts"
  },
  {
    id: "matrix",
    displayName: "Matrix",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-matrix",
    description: "Green terminal-style scan shimmer.",
    particlePreset: "matrix"
  },
  {
    id: "slide",
    displayName: "Slide",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-slide",
    description: "Small horizontal slide loop."
  },
  {
    id: "storm",
    displayName: "Storm",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-storm",
    description: "Lightning-style highlight pulse.",
    particlePreset: "storm"
  },
  {
    id: "glitch",
    displayName: "Glitch",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-glitch",
    description: "Controlled retro glitch offset."
  },
  {
    id: "hype",
    displayName: "Hype",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-hype",
    description: "Punchy supporter emphasis."
  },
  {
    id: "vhs",
    displayName: "VHS",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-vhs",
    description: "Soft chromatic VHS drift."
  },
  {
    id: "laser",
    displayName: "Laser",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-laser",
    description: "Fast laser highlight sweep."
  },
  {
    id: "galaxy",
    displayName: "Galaxy",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-galaxy",
    description: "Cosmic gradient movement.",
    particlePreset: "stars"
  },
  {
    id: "inferno",
    displayName: "Inferno",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-inferno",
    description: "Deeper fire and ember styling.",
    particlePreset: "fire"
  },
  {
    id: "legend",
    displayName: "Legend",
    group: "supporter",
    requiredRole: "supporter",
    isHidden: false,
    className: "bc-chat-effect-legend",
    description: "Premium legendary glow.",
    particlePreset: "stars"
  },
  {
    id: "moderator",
    displayName: "Moderator",
    group: "staff",
    requiredRole: "moderator",
    isHidden: true,
    className: "bc-chat-effect-moderator",
    description: "Hidden moderator emphasis."
  },
  {
    id: "shield",
    displayName: "Shield",
    group: "staff",
    requiredRole: "moderator",
    isHidden: true,
    className: "bc-chat-effect-shield",
    description: "Staff shield shimmer.",
    particlePreset: "sparkles"
  },
  {
    id: "staff-pulse",
    displayName: "Staff Pulse",
    group: "staff",
    requiredRole: "moderator",
    isHidden: true,
    className: "bc-chat-effect-staff-pulse",
    description: "Reserved staff pulse."
  },
  {
    id: "authority",
    displayName: "Authority",
    group: "staff",
    requiredRole: "moderator",
    isHidden: true,
    className: "bc-chat-effect-authority",
    description: "Subtle staff authority treatment.",
    particlePreset: "storm"
  },
  {
    id: "watchtower",
    displayName: "Watchtower",
    group: "staff",
    requiredRole: "moderator",
    isHidden: true,
    className: "bc-chat-effect-watchtower",
    description: "Moderator watchtower scan.",
    particlePreset: "sparkles"
  },
  {
    id: "devmode",
    displayName: "Devmode",
    group: "developer",
    requiredRole: "developer",
    isHidden: true,
    className: "bc-chat-effect-devmode",
    description: "Hidden developer mode styling."
  },
  {
    id: "debug",
    displayName: "Debug",
    group: "developer",
    requiredRole: "developer",
    isHidden: true,
    className: "bc-chat-effect-debug",
    description: "Developer debug text treatment.",
    particlePreset: "matrix"
  },
  {
    id: "compile",
    displayName: "Compile",
    group: "developer",
    requiredRole: "developer",
    isHidden: true,
    className: "bc-chat-effect-compile",
    description: "Compile progress gradient.",
    particlePreset: "matrix"
  },
  {
    id: "terminal",
    displayName: "Terminal",
    group: "developer",
    requiredRole: "developer",
    isHidden: true,
    className: "bc-chat-effect-terminal",
    description: "Terminal cursor styling.",
    renderMode: "letters"
  },
  {
    id: "syntax",
    displayName: "Syntax",
    group: "developer",
    requiredRole: "developer",
    isHidden: true,
    className: "bc-chat-effect-syntax",
    description: "Syntax-highlight gradient.",
    particlePreset: "matrix"
  },
  {
    id: "founder",
    displayName: "Founder",
    group: "owner",
    requiredRole: "owner",
    isHidden: true,
    className: "bc-chat-effect-founder",
    description: "Owner-only founder styling.",
    particlePreset: "crowns"
  },
  {
    id: "bouncecore",
    displayName: "Bouncecore",
    group: "owner",
    requiredRole: "owner",
    isHidden: true,
    className: "bc-chat-effect-bouncecore",
    description: "Owner-only Bouncecore brand effect.",
    particlePreset: "stars"
  },
  {
    id: "reload",
    displayName: "Reload",
    group: "owner",
    requiredRole: "owner",
    isHidden: true,
    className: "bc-chat-effect-reload",
    description: "Owner-only reload sweep.",
    particlePreset: "sparkles"
  },
  {
    id: "mythic",
    displayName: "Mythic",
    group: "owner",
    requiredRole: "owner",
    isHidden: true,
    className: "bc-chat-effect-mythic",
    description: "Owner-only mythic gradient.",
    particlePreset: "stars"
  },
  {
    id: "crown",
    displayName: "Crown",
    group: "owner",
    requiredRole: "owner",
    isHidden: true,
    className: "bc-chat-effect-crown",
    description: "Owner-only crown shimmer.",
    particlePreset: "crowns"
  }
] as const satisfies readonly ChatEffectDefinition[];

export type ChatEffectId = (typeof chatEffects)[number]["id"];

const chatEffectsById = new Map<string, ChatEffectDefinition>(chatEffects.map((effect) => [effect.id, effect]));

const roleRank = {
  viewer: 0,
  supporter: 1,
  moderator: 2,
  developer: 3,
  owner: 4
} as const satisfies Record<ChatEffectRequiredRole, number>;

function chatEffectRank(userTags: readonly Role[] | readonly string[] | null | undefined) {
  const tags = new Set(userTags ?? []);

  if (tags.has("owner")) {
    return roleRank.owner;
  }

  if (tags.has("developer")) {
    return roleRank.developer;
  }

  if (tags.has("moderator")) {
    return roleRank.moderator;
  }

  if (tags.has("supporter")) {
    return roleRank.supporter;
  }

  return tags.size > 0 ? roleRank.viewer : -1;
}

export function getChatEffectById(effectId: string | null | undefined) {
  if (!effectId) {
    return null;
  }

  return chatEffectsById.get(effectId) ?? null;
}

export function canUseChatEffect(userTags: readonly Role[] | readonly string[] | null | undefined, effectId: string | null | undefined) {
  const effect = getChatEffectById(effectId);

  return Boolean(effect && chatEffectRank(userTags) >= roleRank[effect.requiredRole]);
}

export function getAvailableChatEffects(userTags: readonly Role[] | readonly string[] | null | undefined) {
  const rank = chatEffectRank(userTags);

  return chatEffects.filter((effect) => rank >= roleRank[effect.requiredRole]);
}

export function validateChatEffectSelection(userTags: readonly Role[] | readonly string[] | null | undefined, effectId: string | null | undefined) {
  const normalizedEffectId = effectId?.trim();

  if (!normalizedEffectId) {
    return null;
  }

  const effect = getChatEffectById(normalizedEffectId);

  if (!effect) {
    throw new Error("Choose a valid chat text effect.");
  }

  if (!canUseChatEffect(userTags, normalizedEffectId)) {
    throw new Error("You do not have access to that chat text effect.");
  }

  return effect.id;
}
