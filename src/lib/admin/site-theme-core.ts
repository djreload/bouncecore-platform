export type EditableThemeToken = {
  css: string;
  defaultValue: string;
  key: ThemeTokenKey;
  label: string;
  use: string;
  value: string;
};

export type SiteThemeInput = {
  tokens: Array<{
    key: string;
    value?: string;
  }>;
};

export const editableThemeTokenDefinitions = [
  { css: "--color-bc-void", defaultValue: "#05050a", key: "void", label: "Void", use: "Global page background" },
  { css: "--color-bc-ink", defaultValue: "#0b0d14", key: "ink", label: "Ink", use: "Shell sidebars and footer bands" },
  { css: "--color-bc-panel", defaultValue: "#111421", key: "panel", label: "Panel", use: "Primary panels and cards" },
  { css: "--color-bc-panel-2", defaultValue: "#171a2a", key: "panel2", label: "Panel 2", use: "Secondary panels" },
  { css: "--color-bc-line", defaultValue: "#2b3148", key: "line", label: "Line", use: "Borders and dividers" },
  { css: "--color-bc-muted", defaultValue: "#a7b0c4", key: "muted", label: "Muted", use: "Secondary text" },
  { css: "--color-bc-electric", defaultValue: "#00d5ff", key: "electric", label: "Electric", use: "Primary actions and cyan badges" },
  { css: "--color-bc-pink", defaultValue: "#ff2bd6", key: "pink", label: "Pink", use: "Accent actions and alerts" },
  { css: "--color-bc-acid", defaultValue: "#b6ff2e", key: "acid", label: "Acid", use: "Success, stars, and positive status" },
  { css: "--color-bc-violet", defaultValue: "#8b5cf6", key: "violet", label: "Violet", use: "Secondary accent" },
  { css: "--color-bc-amber", defaultValue: "#ffb020", key: "amber", label: "Amber", use: "Warnings and attention states" }
] as const;

export type ThemeTokenKey = (typeof editableThemeTokenDefinitions)[number]["key"];

export type SiteThemePreset = {
  description: string;
  key: string;
  label: string;
  tokens: Record<ThemeTokenKey, string>;
};

export const siteThemePresets = [
  {
    description: "The default Bouncecore dark neon visual identity.",
    key: "bouncecore-neon",
    label: "Bouncecore Neon",
    tokens: {
      acid: "#b6ff2e",
      amber: "#ffb020",
      electric: "#00d5ff",
      ink: "#0b0d14",
      line: "#2b3148",
      muted: "#a7b0c4",
      panel: "#111421",
      panel2: "#171a2a",
      pink: "#ff2bd6",
      violet: "#8b5cf6",
      void: "#05050a"
    }
  },
  {
    description: "Sharper club-light contrast for live streams and chat-heavy pages.",
    key: "laser-club",
    label: "Laser Club",
    tokens: {
      acid: "#55ff7a",
      amber: "#ffe45e",
      electric: "#25f4ff",
      ink: "#070a12",
      line: "#26345c",
      muted: "#b3bed6",
      panel: "#0d1324",
      panel2: "#121a32",
      pink: "#ff38c8",
      violet: "#7c4dff",
      void: "#03040a"
    }
  },
  {
    description: "High-energy rave colours with stronger violet and amber balance.",
    key: "rave-spectrum",
    label: "Rave Spectrum",
    tokens: {
      acid: "#d7ff3f",
      amber: "#ffce45",
      electric: "#00e7ff",
      ink: "#0a0715",
      line: "#3b315e",
      muted: "#c2bce1",
      panel: "#151026",
      panel2: "#20153a",
      pink: "#ff35f2",
      violet: "#9a6cff",
      void: "#05030c"
    }
  },
  {
    description: "Cleaner broadcast-style theme for a more restrained production look.",
    key: "broadcast-pro",
    label: "Broadcast Pro",
    tokens: {
      acid: "#91f04f",
      amber: "#ffbf3f",
      electric: "#35c7ff",
      ink: "#0a1018",
      line: "#314054",
      muted: "#b4c0ce",
      panel: "#111a25",
      panel2: "#172232",
      pink: "#ff5fc8",
      violet: "#7f8cff",
      void: "#05080d"
    }
  }
] as const satisfies readonly SiteThemePreset[];

const themeTokenKeys: Set<string> = new Set(editableThemeTokenDefinitions.map((token) => token.key));

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readSettingPayload(value: unknown, property: string) {
  if (!isObject(value)) {
    return {};
  }

  const payload = value[property];

  return isObject(payload) ? payload : {};
}

function normalizedText(value: string | undefined, maxLength: number, label: string) {
  const text = value?.trim() ?? "";

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedHexColor(value: string | undefined, label: string) {
  const color = normalizedText(value, 9, label);

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`${label} must be a 6-digit hex colour, for example #00d5ff.`);
  }

  return color.toLowerCase();
}

export function mergeThemeTokens(value: unknown): EditableThemeToken[] {
  const payload = readSettingPayload(value, "tokens");

  return editableThemeTokenDefinitions.map((definition) => {
    const saved = payload[definition.key];

    return {
      ...definition,
      value: typeof saved === "string" && /^#[0-9a-fA-F]{6}$/.test(saved) ? saved.toLowerCase() : definition.defaultValue
    };
  });
}

export function normalizeThemeInput(input: SiteThemeInput) {
  return {
    tokens: input.tokens.reduce<Record<string, string>>((settings, token) => {
      if (!themeTokenKeys.has(token.key)) {
        throw new Error("Unknown theme token.");
      }

      const definition = editableThemeTokenDefinitions.find((item) => item.key === token.key);

      return {
        ...settings,
        [token.key]: normalizedHexColor(token.value, definition?.label ?? "Theme colour")
      };
    }, {}),
    version: 1
  };
}

export function defaultThemeTokenValues(): Record<ThemeTokenKey, string> {
  return editableThemeTokenDefinitions.reduce<Record<ThemeTokenKey, string>>((tokens, token) => {
    tokens[token.key] = token.defaultValue;

    return tokens;
  }, {} as Record<ThemeTokenKey, string>);
}
