import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertIsolatedCoreFpsOrigin,
  buildCoreFpsLaunchUrl,
  coreFpsTicketLifetimeSeconds,
  createCoreFpsTicket,
  normalizeCoreFpsPublicUrl,
  verifyCoreFpsTicket
} from "../src/lib/games/core-fps-core.ts";

const secret = "core-fps-test-secret-that-is-longer-than-thirty-two-characters";
const now = new Date("2026-07-23T12:00:00.000Z");

test("Core FPS tickets preserve signed account identity and timing", () => {
  const ticket = createCoreFpsTicket({
    displayName: "Reload",
    now,
    secret,
    userId: "user-123"
  });
  const claims = verifyCoreFpsTicket(ticket, secret, new Date(now.getTime() + 30_000));

  assert.equal(claims.sub, "user-123");
  assert.equal(claims.name, "Reload");
  assert.equal(claims.exp - claims.iat, coreFpsTicketLifetimeSeconds);
});

test("Core FPS rejects tampered and expired tickets", () => {
  const ticket = createCoreFpsTicket({
    displayName: "Reload",
    now,
    secret,
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

  const launch = new URL(buildCoreFpsLaunchUrl("https://core.example.com", "payload.signature"));
  assert.equal(launch.origin, "https://core.example.com");
  assert.equal(launch.searchParams.get("ticket"), "payload.signature");
});

test("Core FPS gateway authenticates play surfaces and blocks the arbitrary proxy", async () => {
  const gateway = await readFile(new URL("../services/core-fps/gateway/default.conf.template", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/app/games/core/page.tsx", import.meta.url), "utf8");

  assert.match(gateway, /location \^~ \/service\/proxy\//);
  assert.match(gateway, /auth_request \/_core_auth/);
  assert.match(gateway, /X-Core-Gateway-Secret/);
  assert.match(gateway, /return 302 \//);
  assert.match(gateway, /frame-ancestors \$\{CORE_FPS_PARENT_ORIGIN\}/);
  assert.match(launcher, /sandbox="allow-downloads allow-fullscreen allow-pointer-lock allow-same-origin allow-scripts"/);
  assert.doesNotMatch(launcher, /CORE_FPS_TICKET_SECRET/);
});

test("Core FPS is exposed as a separate shared game to signed-in chat users", async () => {
  const chatPage = await readFile(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");
  const chatPanel = await readFile(new URL("../src/app/chat/chat-room-panel.tsx", import.meta.url), "utf8");
  const coreLauncher = await readFile(new URL("../src/app/games/core/page.tsx", import.meta.url), "utf8");

  assert.match(chatPage, /getPublicCoreFpsSettings/);
  assert.match(chatPage, /coreFpsEnabled=\{coreFpsSettings\.enabled\}/);
  assert.match(chatPanel, /href="\/games\/core"/);
  assert.match(chatPanel, /Join the shared Core FPS game lobby/);
  assert.match(chatPanel, /\{coreFpsEnabled \? \(/);
  assert.match(coreLauncher, /requireSignedInUser\(\)/);
  assert.doesNotMatch(coreLauncher, /rave-war|RaveWar/);
});
