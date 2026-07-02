#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { buildCheckUrl, evaluateSmokeResponse, normalizeBaseUrl } from "./public-smoke-check.mjs";

const authRejectedText = ["Application error", "Internal Server Error", "auth-required", "access-denied", "This page couldn"];

function protectedHtmlCheck({ id, label, path, requiredText }) {
  return {
    id,
    kind: "html",
    label,
    path,
    rejectedText: authRejectedText,
    requiredText: ["data-bc-visual-part=\"dashboard-shell\"", "data-bc-visual-part=\"dashboard-sidebar\"", ...requiredText]
  };
}

export const defaultAuthenticatedSmokeChecks = [
  protectedHtmlCheck({
    id: "account",
    label: "Account dashboard",
    path: "/account",
    requiredText: ['data-bc-visual-shell="account"', "Dashboard"]
  }),
  protectedHtmlCheck({
    id: "account-security",
    label: "Account security",
    path: "/account/security",
    requiredText: ['data-bc-visual-shell="account"', "Security"]
  }),
  protectedHtmlCheck({
    id: "account-settings",
    label: "Account settings",
    path: "/account/settings",
    requiredText: ['data-bc-visual-shell="account"', "Settings"]
  }),
  protectedHtmlCheck({
    id: "admin",
    label: "Admin dashboard",
    path: "/admin",
    requiredText: ['data-bc-visual-shell="admin"', "Control room", "Dashboard"]
  }),
  protectedHtmlCheck({
    id: "admin-users",
    label: "Admin users",
    path: "/admin/users",
    requiredText: ['data-bc-visual-shell="admin"', "Users"]
  }),
  protectedHtmlCheck({
    id: "admin-system-health",
    label: "Admin system health",
    path: "/admin/system-health",
    requiredText: ['data-bc-visual-shell="admin"', "System health"]
  }),
  protectedHtmlCheck({
    id: "streamer-obs",
    label: "Streamer OBS setup",
    path: "/streamer/obs",
    requiredText: ['data-bc-visual-shell="streamer"', "OBS setup help"]
  }),
  protectedHtmlCheck({
    id: "producer-tracks",
    label: "Producer tracks",
    path: "/producer/tracks",
    requiredText: ['data-bc-visual-shell="producer"', "My tracks"]
  })
];

function usage() {
  console.error(`Usage:
  npm run smoke:auth -- [--base-url https://bouncecore.example.com] [--email owner@example.com] [--password secret] [--json] [--timeout-ms 10000]

Options:
  --base-url    Public site URL. Defaults to SMOKE_BASE_URL, NEXT_PUBLIC_APP_URL, then http://127.0.0.1:3000.
  --email       Smoke account email. Defaults to SMOKE_AUTH_EMAIL.
  --password    Smoke account password. Defaults to SMOKE_AUTH_PASSWORD.
  --json        Print machine-readable JSON.
  --timeout-ms  Per-request timeout. Default: 10000.

The smoke account must be active, email-verified, and have owner/admin permissions for the admin checks.`);
}

export function parseAuthSmokeArgs(argv, env = process.env) {
  const args = {
    baseUrl: env.SMOKE_BASE_URL || env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    email: env.SMOKE_AUTH_EMAIL || "",
    json: false,
    password: env.SMOKE_AUTH_PASSWORD || "",
    timeoutMs: 10000
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--base-url") {
      args.baseUrl = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--base-url=")) {
      args.baseUrl = arg.slice("--base-url=".length);
      continue;
    }

    if (arg === "--email") {
      args.email = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--email=")) {
      args.email = arg.slice("--email=".length);
      continue;
    }

    if (arg === "--password") {
      args.password = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--password=")) {
      args.password = arg.slice("--password=".length);
      continue;
    }

    if (arg === "--timeout-ms") {
      args.timeoutMs = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = Number(arg.slice("--timeout-ms=".length));
      continue;
    }

    usage();
    throw new Error(`Unknown argument: ${arg}`);
  }

  args.baseUrl = normalizeBaseUrl(args.baseUrl);
  args.email = args.email.trim();

  if (!args.email || !args.password) {
    throw new Error("SMOKE_AUTH_EMAIL and SMOKE_AUTH_PASSWORD are required for authenticated smoke checks.");
  }

  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000 || args.timeoutMs > 60000) {
    throw new Error("--timeout-ms must be a whole number between 1000 and 60000.");
  }

  return args;
}

export function extractSetCookieHeaders(headers) {
  const splitSetCookieHeader = (header) => header.split(/,(?=\s*[^=;,\s]+=)/).map((value) => value.trim()).filter(Boolean);

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().flatMap(splitSetCookieHeader);
  }

  const header = headers.get("set-cookie");

  if (!header) {
    return [];
  }

  return splitSetCookieHeader(header);
}

export function buildCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((header) => header.split(";", 1)[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

async function login({ baseUrl, email, fetchImpl, password, timeoutMs }) {
  const response = await fetchImpl(buildCheckUrl(baseUrl, "/api/auth/login"), {
    body: new URLSearchParams({ email, password }),
    headers: {
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "BouncecoreAuthenticatedSmoke/1.0"
    },
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });

  const setCookieHeaders = extractSetCookieHeaders(response.headers);
  const cookieHeader = buildCookieHeader(setCookieHeaders);

  if (!response.status.toString().startsWith("3") || !cookieHeader.includes("bouncecore_session=")) {
    const location = response.headers.get("location") ?? "";
    const suffix = location ? ` Redirect: ${location}` : "";

    throw new Error(`Authenticated smoke login failed with HTTP ${response.status}.${suffix}`);
  }

  return cookieHeader;
}

async function fetchAuthenticatedHtml({ baseUrl, check, cookieHeader, fetchImpl, timeoutMs }) {
  return fetchImpl(buildCheckUrl(baseUrl, check.path), {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      cookie: cookieHeader,
      "user-agent": "BouncecoreAuthenticatedSmoke/1.0"
    },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });
}

export async function runAuthenticatedSmokeChecks({
  baseUrl,
  checks = defaultAuthenticatedSmokeChecks,
  email,
  fetchImpl = fetch,
  password,
  timeoutMs = 10000
}) {
  const startedAt = new Date().toISOString();
  const cookieHeader = await login({ baseUrl, email, fetchImpl, password, timeoutMs });
  const results = [];

  for (const check of checks) {
    const url = buildCheckUrl(baseUrl, check.path);
    const started = performance.now();

    try {
      const response = await fetchAuthenticatedHtml({ baseUrl, check, cookieHeader, fetchImpl, timeoutMs });
      const evaluation = await evaluateSmokeResponse(check, response);
      const durationMs = Math.round(performance.now() - started);

      results.push({
        bytes: evaluation.bytes ?? 0,
        durationMs,
        error: evaluation.error ?? "",
        id: check.id,
        kind: check.kind,
        label: check.label,
        ok: evaluation.ok,
        path: check.path,
        status: response.status,
        url
      });
    } catch (error) {
      results.push({
        bytes: 0,
        durationMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : "Request failed.",
        id: check.id,
        kind: check.kind,
        label: check.label,
        ok: false,
        path: check.path,
        status: 0,
        url
      });
    }
  }

  const failed = results.filter((result) => !result.ok).length;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    checkedAt: startedAt,
    failed,
    passed: results.length - failed,
    results,
    status: failed ? "failed" : "healthy"
  };
}

function printTextReport(report) {
  console.log("Bouncecore authenticated smoke check");
  console.log(`Target: ${report.baseUrl}`);
  console.log(`Checked: ${report.checkedAt}`);
  console.log(`Result: ${report.status} (${report.passed} passed, ${report.failed} failed)`);
  console.log("");

  for (const result of report.results) {
    const status = result.ok ? "ok" : "fail";
    const detail = result.ok ? `${result.status}, ${result.durationMs}ms` : `${result.status || "error"}, ${result.error}`;

    console.log(`- [${status}] ${result.label} ${result.path} (${detail})`);
  }
}

async function main() {
  const args = parseAuthSmokeArgs(process.argv);
  const report = await runAuthenticatedSmokeChecks(args);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Authenticated smoke check failed.");
    process.exitCode = 1;
  });
}
