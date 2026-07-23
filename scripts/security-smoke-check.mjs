#!/usr/bin/env node
import { pathToFileURL } from "node:url";

function normalizeBaseUrl(value) {
  const url = new URL(value || "http://127.0.0.1:3100");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function requestCheck(baseUrl, check, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      body: check.body,
      headers: check.headers,
      method: check.method ?? "GET",
      redirect: "manual",
      signal: controller.signal
    });
    const ok = check.statuses.includes(response.status) && (!check.verify || check.verify(response));
    return { id: check.id, ok, path: check.path, status: response.status };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Request failed.", id: check.id, ok: false, path: check.path, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function runSecuritySmokeChecks(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const production = new URL(baseUrl).protocol === "https:";
  const jsonHeaders = { "content-type": "application/json" };
  const checks = [
    { id: "health", path: "/api/health", statuses: [200] },
    { id: "admin-rbac-auth", path: "/api/admin/rbac", statuses: [401, 403] },
    { body: JSON.stringify({}), headers: jsonHeaders, id: "admin-upload-auth", method: "POST", path: "/api/admin/uploads", statuses: [401, 403] },
    { body: JSON.stringify({ roomId: "unauthorized", targetUserId: "unauthorized" }), headers: jsonHeaders, id: "rave-war-auth", method: "POST", path: "/api/rave-wars/challenges", statuses: [401, 403] },
    { body: "{}", headers: jsonHeaders, id: "square-signature", method: "POST", path: "/api/payments/square/webhook", statuses: [401] },
    { body: "{}", headers: jsonHeaders, id: "paypal-signature", method: "POST", path: "/api/payments/paypal/webhook", statuses: [400, 401] },
    { id: "upload-traversal", path: "/uploads/%2e%2e/%2e%2e/etc/passwd", statuses: [400, 404] },
    {
      id: "security-headers",
      path: "/auth/login",
      statuses: [200],
      verify: (response) =>
        Boolean(response.headers.get("x-content-type-options")) &&
        Boolean(response.headers.get("x-frame-options") || response.headers.get("content-security-policy")) &&
        (!production || Boolean(response.headers.get("strict-transport-security")))
    }
  ];
  const results = [];

  for (const check of checks) results.push(await requestCheck(baseUrl, check, input.timeoutMs ?? 15_000));

  return {
    baseUrl,
    failed: results.filter((result) => !result.ok).length,
    passed: results.filter((result) => result.ok).length,
    results,
    status: results.every((result) => result.ok) ? "healthy" : "failed"
  };
}

async function main() {
  const baseUrlIndex = process.argv.indexOf("--base-url");
  const baseUrl = baseUrlIndex >= 0 ? process.argv[baseUrlIndex + 1] : process.env.SECURITY_SMOKE_BASE_URL;
  const report = await runSecuritySmokeChecks({ baseUrl });
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Security smoke check failed.");
    process.exitCode = 1;
  });
}
