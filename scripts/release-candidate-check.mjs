#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runAuthenticatedSmokeChecks } from "./authenticated-smoke-check.mjs";
import { normalizeBaseUrl, runSmokeChecks } from "./public-smoke-check.mjs";

export function releaseCandidateConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.SMOKE_BASE_URL || env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000");
  const email = env.SMOKE_AUTH_EMAIL?.trim() ?? "";
  const password = env.SMOKE_AUTH_PASSWORD ?? "";
  const timeoutMs = Number(env.SMOKE_TIMEOUT_MS || 15_000);

  if (!email || !password) {
    throw new Error("SMOKE_AUTH_EMAIL and SMOKE_AUTH_PASSWORD are required for the release-candidate check.");
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) {
    throw new Error("SMOKE_TIMEOUT_MS must be a whole number between 1000 and 60000.");
  }

  return { baseUrl, email, password, timeoutMs };
}

export async function runReleaseCandidateCheck(config) {
  const publicReport = await runSmokeChecks(config);
  const authenticatedReport = await runAuthenticatedSmokeChecks(config);
  const failed = publicReport.failed + authenticatedReport.failed;

  return {
    authenticated: authenticatedReport,
    baseUrl: config.baseUrl,
    checkedAt: new Date().toISOString(),
    failed,
    passed: publicReport.passed + authenticatedReport.passed,
    public: publicReport,
    status: failed ? "failed" : "healthy"
  };
}

async function main() {
  const report = await runReleaseCandidateCheck(releaseCandidateConfig());

  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Release-candidate check failed.");
    process.exitCode = 1;
  });
}
