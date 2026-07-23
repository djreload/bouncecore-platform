import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertIsolatedCoreFpsOrigin,
  buildCoreFpsLaunchUrl,
  createCoreFpsRuntimePlayerName,
  coreFpsTicketLifetimeSeconds,
  createCoreFpsTicket,
  normalizeCoreFpsPublicUrl,
  verifyCoreFpsTicket
} from "../src/lib/games/core-fps-core.ts";
import { calculateCoreFpsScore } from "../src/lib/games/core-fps-score-service.ts";

const secret = "core-fps-test-secret-that-is-longer-than-thirty-two-characters";
const now = new Date("2026-07-23T12:00:00.000Z");

test("Core FPS tickets preserve signed account identity and timing", () => {
  const ticket = createCoreFpsTicket({
    displayName: "Reload",
    now,
    playerName: "Reload-a1b2c3",
    secret,
    sessionId: "session-123",
    userId: "user-123"
  });
  const claims = verifyCoreFpsTicket(ticket, secret, new Date(now.getTime() + 30_000));

  assert.equal(claims.sub, "user-123");
  assert.equal(claims.name, "Reload");
  assert.equal(claims.player, "Reload-a1b2c3");
  assert.equal(claims.sid, "session-123");
  assert.equal(claims.exp - claims.iat, coreFpsTicketLifetimeSeconds);
});

test("Core FPS rejects tampered and expired tickets", () => {
  const ticket = createCoreFpsTicket({
    displayName: "Reload",
    now,
    playerName: "Reload-a1b2c3",
    secret,
    sessionId: "session-123",
    userId: "user-123"
  });
  const [payload, signature] = ticket.split(".");

  assert.throws(() => verifyCoreFpsTicket(`${payload}.${signature.slice(0, -1)}x`, secret, now), /invalid/i);
  assert.throws(
    () => verifyCoreFpsTicket(ticket, secret, new Date(now.getTime() + (coreFpsTicketLifetimeSeconds + 1) * 1000)),
    /expired/i
  );
});

test("Core FPS public URLs require isolated HTTPS outside localhost", () => {
  assert.equal(normalizeCoreFpsPublicUrl("https://core.example.com/"), "https://core.example.com");
  assert.equal(normalizeCoreFpsPublicUrl("http://127.0.0.1:18443"), "http://127.0.0.1:18443");
  assert.throws(() => normalizeCoreFpsPublicUrl("http://core.example.com"), /HTTPS/i);
  assert.throws(() => normalizeCoreFpsPublicUrl("https://core.example.com/?ticket=leak"), /query/i);
  assert.equal(assertIsolatedCoreFpsOrigin("https://core.example.com", "https://app.example.com"), "https://core.example.com");
  assert.throws(() => assertIsolatedCoreFpsOrigin("https://app.example.com", "https://app.example.com"), /separate origin/i);

  const launch = new URL(buildCoreFpsLaunchUrl("https://core.example.com", "payload.signature", "Reload-a1b2c3"));
  assert.equal(launch.origin, "https://core.example.com");
  assert.equal(launch.searchParams.get("ticket"), "payload.signature");
  assert.equal(launch.searchParams.get("cmd"), "name Reload-a1b2c3");
  assert.equal(createCoreFpsRuntimePlayerName("Reload User", "39c5137d-56d7-4ae6-8751-a1b2c3d4e5f6"), "ReloadUs-d4e5f6");
});

test("Core FPS gateway authenticates play surfaces and blocks the arbitrary proxy", async () => {
  const gateway = await readFile(new URL("../services/core-fps/gateway/default.conf.template", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/app/games/core/play/page.tsx", import.meta.url), "utf8");

  assert.match(gateway, /location \^~ \/service\/proxy\//);
  assert.match(gateway, /auth_request \/_core_auth/);
  assert.match(gateway, /X-Core-Gateway-Secret/);
  assert.match(gateway, /return 302 \$core_launch_redirect/);
  assert.match(gateway, /X-Core-Session-Id \$core_session_id/);
  assert.match(gateway, /frame-ancestors \$\{CORE_FPS_PARENT_ORIGIN\}/);
  assert.match(launcher, /sandbox="allow-downloads allow-fullscreen allow-pointer-lock allow-same-origin allow-scripts"/);
  assert.doesNotMatch(launcher, /CORE_FPS_TICKET_SECRET/);
});

test("Core FPS is exposed as a separate shared game to signed-in chat users", async () => {
  const chatPage = await readFile(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");
  const chatPanel = await readFile(new URL("../src/app/chat/chat-room-panel.tsx", import.meta.url), "utf8");
  const coreHub = await readFile(new URL("../src/app/games/core/page.tsx", import.meta.url), "utf8");
  const coreLauncher = await readFile(new URL("../src/app/games/core/play/page.tsx", import.meta.url), "utf8");

  assert.match(chatPage, /getPublicCoreFpsSettings/);
  assert.match(chatPage, /coreFpsEnabled=\{coreFpsSettings\.enabled\}/);
  assert.match(chatPanel, /href="\/games\/core"/);
  assert.match(chatPanel, /Join the shared Core FPS game lobby/);
  assert.match(chatPanel, /\{coreFpsEnabled \? \(/);
  assert.match(coreHub, /href="\/games\/core\/play"/);
  assert.match(coreHub, /All-time leaderboard/);
  assert.match(coreHub, /How scoring works/);
  assert.match(coreHub, /Controls/);
  assert.match(coreLauncher, /requireSignedInUser\(\)/);
  assert.doesNotMatch(coreLauncher, /rave-war|RaveWar/);
});

test("Core FPS scores use server counters and the telemetry route is secret-only", async () => {
  const telemetryRoute = await readFile(
    new URL("../src/app/api/internal/games/core/telemetry/route.ts", import.meta.url),
    "utf8"
  );
  const presenceRoute = await readFile(
    new URL("../src/app/api/games/core/sessions/[sessionId]/presence/route.ts", import.meta.url),
    "utf8"
  );
  const relay = await readFile(new URL("../services/core-fps/telemetry/main.go", import.meta.url), "utf8");
  const compose = await readFile(new URL("../docker-compose.staging.yml", import.meta.url), "utf8");

  assert.equal(
    calculateCoreFpsScore({
      deaths: 2,
      flags: 1,
      frags: 5,
      teamKills: 1
    }),
    650
  );
  assert.match(telemetryRoute, /CORE_FPS_TELEMETRY_SECRET/);
  assert.match(telemetryRoute, /x-core-telemetry-secret/);
  assert.doesNotMatch(telemetryRoute, /getCurrentUser/);
  assert.match(presenceRoute, /getCurrentUser/);
  assert.match(relay, /protocol\.ServerInfo/);
  assert.match(relay, /protocol\.Damage/);
  assert.match(relay, /protocol\.Died/);
  assert.match(relay, /protocol\.ScoreFlag/);
  assert.match(relay, /X-Core-Telemetry-Secret/);
  assert.match(compose, /core-fps-telemetry:/);
  assert.match(compose, /CORE_FPS_WEBSOCKET_UPSTREAM: core-fps-telemetry:1338/);
});
