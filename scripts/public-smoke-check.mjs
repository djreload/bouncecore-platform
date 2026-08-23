#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const publicShellRequiredText = ['data-bc-visual-shell="public"', 'data-bc-visual-part="site-header"'];
const defaultHtmlRejectedText = ["Application error", "Internal Server Error", "This page couldn"];

function publicHtmlCheck({ id, label, path, requiredText = [] }) {
  return {
    id,
    kind: "html",
    label,
    path,
    rejectedText: defaultHtmlRejectedText,
    requiredText: [...publicShellRequiredText, ...requiredText]
  };
}

export const defaultSmokeChecks = [
  publicHtmlCheck({ id: "home", label: "Home page", path: "/", requiredText: ["Platform modules"] }),
  publicHtmlCheck({ id: "live", label: "Live page", path: "/live", requiredText: ["data-live-primary-video-slot"] }),
  publicHtmlCheck({ id: "chat", label: "Chat page", path: "/chat", requiredText: ["Bouncecore Chat"] }),
  publicHtmlCheck({ id: "music", label: "Music catalogue", path: "/music", requiredText: ["Bouncecore Music"] }),
  publicHtmlCheck({ id: "shop", label: "Shop catalogue", path: "/shop", requiredText: ["Merch shop"] }),
  publicHtmlCheck({ id: "support", label: "Support page", path: "/support", requiredText: ["Help desk"] }),
  publicHtmlCheck({ id: "mobile", label: "Mobile app page", path: "/mobile", requiredText: ["Bouncecore Android app"] }),
  publicHtmlCheck({ id: "account-delete", label: "Account deletion page", path: "/account/delete", requiredText: ["Account deletion"] }),
  publicHtmlCheck({ id: "privacy", label: "Privacy policy", path: "/privacy" }),
  publicHtmlCheck({ id: "privacy-requests", label: "Privacy requests page", path: "/privacy/requests", requiredText: ["Privacy requests"] }),
  publicHtmlCheck({ id: "terms", label: "Terms page", path: "/terms" }),
  publicHtmlCheck({ id: "cookies", label: "Cookie policy", path: "/cookies" }),
  { id: "health", kind: "json", label: "Health API", path: "/api/health", validator: validateHealthPayload },
  { id: "mobile-config", kind: "json", label: "Mobile config API", path: "/api/mobile/v1/config" },
  { id: "mobile-live", kind: "json", label: "Mobile live API", path: "/api/mobile/v1/live" },
  { id: "favicon", kind: "asset", label: "Favicon asset", path: "/favicon.svg" },
  { id: "offline-image", kind: "asset", label: "Offline stream image", path: "/images/bouncecore-stage-hero.png" }
];

function usage() {
  console.error(`Usage:
  npm run smoke:public -- [--base-url https://bouncecore.example.com] [--json] [--timeout-ms 10000]

Options:
  --base-url    Public site URL. Defaults to SMOKE_BASE_URL, NEXT_PUBLIC_APP_URL, then http://127.0.0.1:3000.
  --json        Print machine-readable JSON.
  --timeout-ms  Per-request timeout. Default: 10000.`);
}

function validateHealthPayload(payload) {
  if (!payload || payload.ok !== true || payload.status !== "healthy") {
    return "Health API did not report ok=true and status=healthy.";
  }

  return "";
}

export function normalizeBaseUrl(value) {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error("A base URL is required.");
  }

  let url;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`Invalid base URL: ${rawValue}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Base URL must use http or https.");
  }

  url.hash = "";
  url.search = "";

  return url.toString().replace(/\/$/, "");
}

export function buildCheckUrl(baseUrl, path) {
  return new URL(path, `${normalizeBaseUrl(baseUrl)}/`).toString();
}

export function parseArgs(argv, env = process.env) {
  const args = {
    baseUrl: env.SMOKE_BASE_URL || env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000",
    json: false,
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

  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000 || args.timeoutMs > 60000) {
    throw new Error("--timeout-ms must be a whole number between 1000 and 60000.");
  }

  return args;
}

async function textPreview(response) {
  try {
    const text = await response.text();

    return text.replace(/\s+/g, " ").trim().slice(0, 160);
  } catch {
    return "";
  }
}

export async function evaluateSmokeResponse(check, response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const preview = await textPreview(response);
    const suffix = preview ? `: ${preview}` : "";

    return {
      ok: false,
      error: `HTTP ${response.status}${suffix}`
    };
  }

  if (check.kind === "asset") {
    const bytes = await response.arrayBuffer();

    if (!bytes.byteLength) {
      return { ok: false, error: "Asset response was empty." };
    }

    if (!contentType.toLowerCase().startsWith("image/")) {
      return { ok: false, error: `Expected image content-type, received ${contentType || "missing"}.` };
    }

    return { ok: true, bytes: bytes.byteLength };
  }

  const text = await response.text();

  if (check.kind === "html") {
    if (!contentType.toLowerCase().includes("text/html")) {
      return { ok: false, error: `Expected HTML content-type, received ${contentType || "missing"}.` };
    }

    if (!/<html[\s>]/i.test(text)) {
      return { ok: false, error: "HTML response did not include a document root." };
    }

    for (const requiredText of check.requiredText ?? []) {
      if (!text.includes(requiredText)) {
        return { ok: false, error: `HTML response did not include required text: ${requiredText}` };
      }
    }

    for (const rejectedText of check.rejectedText ?? []) {
      if (text.includes(rejectedText)) {
        return { ok: false, error: `HTML response included rejected text: ${rejectedText}` };
      }
    }

    return { ok: true, bytes: Buffer.byteLength(text) };
  }

  if (check.kind === "json") {
    if (!contentType.toLowerCase().includes("application/json")) {
      return { ok: false, error: `Expected JSON content-type, received ${contentType || "missing"}.` };
    }

    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, error: "JSON response could not be parsed." };
    }

    const validationError = check.validator?.(payload) ?? "";

    if (validationError) {
      return { ok: false, error: validationError };
    }

    return { ok: true, bytes: Buffer.byteLength(text) };
  }

  return { ok: false, error: `Unknown smoke check kind: ${check.kind}` };
}

async function fetchWithTimeout(url, timeoutMs) {
  return fetch(url, {
    headers: {
      accept: "text/html,application/json,image/*;q=0.9,*/*;q=0.8",
      "user-agent": "BouncecorePublicSmoke/1.0"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
}

export async function runSmokeChecks({ baseUrl, checks = defaultSmokeChecks, timeoutMs = 10000 }) {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const check of checks) {
    const url = buildCheckUrl(baseUrl, check.path);
    const started = performance.now();

    try {
      const response = await fetchWithTimeout(url, timeoutMs);
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
  console.log("Bouncecore public smoke check");
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
  const args = parseArgs(process.argv);
  const report = await runSmokeChecks(args);

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
    console.error(error instanceof Error ? error.message : "Public smoke check failed.");
    process.exitCode = 1;
  });
}
