const localHostnames = new Set(["127.0.0.1", "::1", "localhost", "postgres"]);

function hostnameFromUrl(value: string, label: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
}

export function assertLocalReleaseDrillSafety(input: {
  appUrl: string;
  confirmation: string;
  databaseUrl: string;
  paypalMode: string;
  squareMode: string;
}) {
  if (input.confirmation !== "LOCAL-ONLY") {
    throw new Error("Set RELEASE_DRILL_CONFIRM=LOCAL-ONLY to run the isolated release drill.");
  }

  const appHostname = hostnameFromUrl(input.appUrl, "Application URL");
  const databaseHostname = hostnameFromUrl(input.databaseUrl, "Database URL");

  if (!localHostnames.has(appHostname)) {
    throw new Error(`Release drill refused non-local application host: ${appHostname}.`);
  }

  if (!localHostnames.has(databaseHostname)) {
    throw new Error(`Release drill refused non-local database host: ${databaseHostname}.`);
  }

  if (input.paypalMode !== "sandbox") {
    throw new Error("Release drill requires PayPal sandbox mode.");
  }

  if (input.squareMode !== "sandbox") {
    throw new Error("Release drill requires Square sandbox mode.");
  }

  return {
    appHostname,
    databaseHostname,
    paypalMode: input.paypalMode,
    squareMode: input.squareMode
  };
}
