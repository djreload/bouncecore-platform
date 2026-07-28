import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  assertIsolatedCoreFpsOrigin,
  buildCoreFpsLaunchUrl,
  coreFpsSourceRef,
  coreFpsSourceRepository,
  createCoreFpsTicket,
  normalizeCoreFpsPublicUrl
} from "@/lib/games/core-fps-core";
import {
  coreFpsDefaultLobbyWaitSeconds,
  normalizeCoreFpsLobbyWaitSeconds,
  normalizeCoreFpsMapPool,
  normalizeCoreFpsModePool
} from "@/lib/games/core-fps-lobby-core";
import { getOrCreateCoreFpsSession } from "@/lib/games/core-fps-score-service";

const coreFpsSettingsKey = "games.core-fps";

export type CoreFpsSettings = {
  enabled: boolean;
  lobbyWaitSeconds: number;
  mapPool: string[];
  modePool: string[];
  publicUrl: string | null;
};

export type CoreFpsSettingsInput = {
  enabled: boolean;
  lobbyWaitSeconds?: number | string;
  mapPool?: string[];
  modePool?: string[];
  publicUrl?: string;
};

type CoreFpsLaunchUser = {
  displayName: string;
  id: string;
};

function envEnabled() {
  return ["1", "true", "yes", "on"].includes((process.env.CORE_FPS_ENABLED ?? "").trim().toLowerCase());
}

function defaultSettings(): CoreFpsSettings {
  return {
    enabled: envEnabled(),
    lobbyWaitSeconds: coreFpsDefaultLobbyWaitSeconds,
    mapPool: normalizeCoreFpsMapPool(undefined),
    modePool: normalizeCoreFpsModePool(undefined),
    publicUrl: normalizeCoreFpsPublicUrl(process.env.CORE_FPS_PUBLIC_URL)
  };
}

function mergeSettings(value: unknown): CoreFpsSettings {
  const defaults = defaultSettings();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const stored = value as Record<string, unknown>;
  let publicUrl = defaults.publicUrl;

  if (typeof stored.publicUrl === "string") {
    try {
      publicUrl = normalizeCoreFpsPublicUrl(stored.publicUrl);
    } catch {
      publicUrl = defaults.publicUrl;
    }
  }

  return {
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : defaults.enabled,
    lobbyWaitSeconds: normalizeCoreFpsLobbyWaitSeconds(stored.lobbyWaitSeconds),
    mapPool: normalizeCoreFpsMapPool(stored.mapPool),
    modePool: normalizeCoreFpsModePool(stored.modePool),
    publicUrl
  };
}

async function readSettings() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: coreFpsSettingsKey
    }
  });

  return {
    settings: mergeSettings(setting?.value),
    source: setting ? ("database" as const) : ("environment" as const),
    updatedAt: setting?.updatedAt ?? null
  };
}

export async function getPublicCoreFpsSettings() {
  return (await readSettings()).settings;
}

export async function getAdminCoreFpsData() {
  const { settings, source, updatedAt } = await readSettings();
  const ticketSecretReady = (process.env.CORE_FPS_TICKET_SECRET?.trim().length ?? 0) >= 32;
  const gatewaySecretReady = (process.env.CORE_FPS_GATEWAY_SHARED_SECRET?.trim().length ?? 0) >= 32;
  const telemetrySecretReady = (process.env.CORE_FPS_TELEMETRY_SECRET?.trim().length ?? 0) >= 32;

  return {
    checks: [
      {
        detail: settings.publicUrl ?? "Set the dedicated HTTPS hostname used by the isolated game gateway.",
        label: "Public game URL",
        ready: Boolean(settings.publicUrl)
      },
      {
        detail: ticketSecretReady
          ? "Signed player launch tickets are available."
          : "Set CORE_FPS_TICKET_SECRET to a random value containing at least 32 characters.",
        label: "Ticket signing",
        ready: ticketSecretReady
      },
      {
        detail: gatewaySecretReady
          ? "The internal gateway authentication endpoint is protected."
          : "Set CORE_FPS_GATEWAY_SHARED_SECRET to a different random value containing at least 32 characters.",
        label: "Gateway authentication",
        ready: gatewaySecretReady
      },
      {
        detail: telemetrySecretReady
          ? "Verified score telemetry can be accepted from the isolated game service."
          : "Set CORE_FPS_TELEMETRY_SECRET to a third, independent random value containing at least 32 characters.",
        label: "Score telemetry",
        ready: telemetrySecretReady
      }
    ],
    configured: Boolean(settings.publicUrl && ticketSecretReady && gatewaySecretReady && telemetrySecretReady),
    settings,
    source,
    sourceRef: coreFpsSourceRef,
    sourceRepository: coreFpsSourceRepository,
    updatedAt: updatedAt?.toISOString() ?? null
  };
}

export async function updateCoreFpsSettings(input: CoreFpsSettingsInput, actorId: string) {
  const settings: CoreFpsSettings = {
    enabled: input.enabled,
    lobbyWaitSeconds: normalizeCoreFpsLobbyWaitSeconds(input.lobbyWaitSeconds),
    mapPool: normalizeCoreFpsMapPool(input.mapPool),
    modePool: normalizeCoreFpsModePool(input.modePool),
    publicUrl: input.publicUrl
      ? assertIsolatedCoreFpsOrigin(input.publicUrl, process.env.NEXT_PUBLIC_APP_URL)
      : null
  };

  if (settings.enabled && !settings.publicUrl) {
    throw new Error("Set the Core FPS public URL before enabling the game.");
  }

  if (settings.enabled && (process.env.CORE_FPS_TICKET_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("Configure CORE_FPS_TICKET_SECRET before enabling Core FPS.");
  }

  if (settings.enabled && (process.env.CORE_FPS_GATEWAY_SHARED_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("Configure CORE_FPS_GATEWAY_SHARED_SECRET before enabling Core FPS.");
  }

  if (settings.enabled && (process.env.CORE_FPS_TELEMETRY_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("Configure CORE_FPS_TELEMETRY_SECRET before enabling Core FPS.");
  }

  await prisma.appSetting.upsert({
    where: {
      key: coreFpsSettingsKey
    },
    update: {
      description: "Public launcher state and isolated origin for the Core FPS game.",
      isSecret: false,
      value: settings as Prisma.InputJsonValue
    },
    create: {
      description: "Public launcher state and isolated origin for the Core FPS game.",
      isSecret: false,
      key: coreFpsSettingsKey,
      value: settings as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    actorId,
    action: "games.core-fps.settings.update",
    target: `app-setting:${coreFpsSettingsKey}`,
    severity: settings.enabled ? "warning" : "info",
    metadata: {
      enabled: settings.enabled,
      lobbyWaitSeconds: settings.lobbyWaitSeconds,
      mapPool: settings.mapPool,
      modePool: settings.modePool,
      publicUrl: settings.publicUrl
    }
  });

  return settings;
}

export async function createCoreFpsLaunch(
  user: CoreFpsLaunchUser,
  lobby: {
    id: string;
    mapName: string;
    modeName: string;
  }
) {
  const settings = await getPublicCoreFpsSettings();

  if (!settings.enabled) {
    throw new Error("Core FPS is currently disabled.");
  }

  if (!settings.publicUrl) {
    throw new Error("Core FPS does not have a public game URL yet.");
  }

  assertIsolatedCoreFpsOrigin(settings.publicUrl, process.env.NEXT_PUBLIC_APP_URL);

  const ticketSecret = process.env.CORE_FPS_TICKET_SECRET ?? "";
  const session = await getOrCreateCoreFpsSession(user, lobby.id);
  const ticket = createCoreFpsTicket({
    displayName: user.displayName,
    lobbyId: lobby.id,
    playerName: session.runtimePlayerName,
    secret: ticketSecret,
    sessionId: session.id,
    userId: user.id
  });

  return {
    launchUrl: buildCoreFpsLaunchUrl(
      settings.publicUrl,
      ticket,
      session.runtimePlayerName,
      lobby.mapName,
      lobby.modeName
    ),
    lobbyId: lobby.id,
    mapName: lobby.mapName,
    modeName: lobby.modeName,
    publicUrl: settings.publicUrl,
    sessionId: session.id
  };
}
