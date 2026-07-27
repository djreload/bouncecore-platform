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
import {
  coreFpsInviteActionUrl,
  getCoreFpsInviteRecipientIds
} from "../src/lib/games/core-fps-invite-core.ts";
import {
  coreFpsReadyCountdownSeconds,
  coreFpsLobbyIsReusable,
  coreFpsLobbyShouldStart,
  normalizeCoreFpsLobbyWaitSeconds,
  normalizeCoreFpsMapPool,
  pickRandomCoreFpsMap,
  shortenedCoreFpsLobbyDeadline
} from "../src/lib/games/core-fps-lobby-core.ts";
import {
  buildCoreFpsResultBody,
  coreFpsLifecycleCutoffs,
  coreFpsSessionLaunchGraceWindowMs,
  coreFpsSessionPresenceWindowMs
} from "../src/lib/games/core-fps-reconciliation-core.ts";

const secret = "core-fps-test-secret-that-is-longer-than-thirty-two-characters";
const now = new Date("2026-07-23T12:00:00.000Z");

test("Core FPS chat activations invite online chatters once and preserve the launch action", () => {
  assert.deepEqual(
    getCoreFpsInviteRecipientIds(
      [
        { id: "starter", status: "online" },
        { id: "online", status: "online" },
        { id: "online", status: "online" },
        { id: "away", status: "away" }
      ],
      "starter"
    ),
    ["online"]
  );
  assert.equal(coreFpsInviteActionUrl("activation/id"), "/games/core/play?invite=activation%2Fid");
});

test("Core FPS tickets preserve signed account identity and timing", () => {
  const ticket = createCoreFpsTicket({
    displayName: "Reload",
    lobbyId: "lobby-123",
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
  assert.equal(claims.lid, "lobby-123");
  assert.equal(claims.exp - claims.iat, coreFpsTicketLifetimeSeconds);
});

test("Core FPS rejects tampered and expired tickets", () => {
  const ticket = createCoreFpsTicket({
    displayName: "Reload",
    lobbyId: "lobby-123",
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

  const launch = new URL(
    buildCoreFpsLaunchUrl(
      "https://core.example.com",
      "payload.signature",
      "Reload-a1b2c3",
      "dust2"
    )
  );
  assert.equal(launch.origin, "https://core.example.com");
  assert.equal(launch.searchParams.get("ticket"), "payload.signature");
  assert.equal(launch.searchParams.get("cmd"), "name Reload-a1b2c3; join lobby");
  assert.equal(launch.searchParams.get("lobbyMap"), "dust2");
  assert.equal(createCoreFpsRuntimePlayerName("Reload User", "39c5137d-56d7-4ae6-8751-a1b2c3d4e5f6"), "ReloadUs-d4e5f6");
});

test("Core FPS lobbies normalize countdowns and choose one allowed random map", () => {
  assert.equal(normalizeCoreFpsLobbyWaitSeconds("5"), 10);
  assert.equal(normalizeCoreFpsLobbyWaitSeconds("45"), 45);
  assert.equal(normalizeCoreFpsLobbyWaitSeconds("999"), 180);
  assert.deepEqual(normalizeCoreFpsMapPool(["DUST2", "dust2", "unknown", "complex"]), [
    "dust2",
    "complex"
  ]);
  assert.equal(pickRandomCoreFpsMap(["complex", "dust2", "turbine"], 0), "complex");
  assert.equal(pickRandomCoreFpsMap(["complex", "dust2", "turbine"], 0.99), "turbine");

  const originalDeadline = new Date(now.getTime() + 60_000);
  const shortened = shortenedCoreFpsLobbyDeadline(originalDeadline, now);

  assert.equal(shortened.getTime(), now.getTime() + coreFpsReadyCountdownSeconds * 1000);
  assert.equal(coreFpsLobbyShouldStart("waiting", shortened, now), false);
  assert.equal(coreFpsLobbyShouldStart("waiting", shortened, shortened), true);
  assert.equal(coreFpsLobbyShouldStart("active", shortened, shortened), false);
  assert.equal(
    coreFpsLobbyIsReusable(
      {
        activeParticipantCount: 1,
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        status: "active"
      },
      now
    ),
    true
  );
  assert.equal(
    coreFpsLobbyIsReusable(
      {
        activeParticipantCount: 0,
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        status: "active"
      },
      now
    ),
    false
  );
  assert.equal(
    coreFpsLobbyIsReusable(
      {
        activeParticipantCount: 0,
        createdAt: now,
        status: "waiting"
      },
      now
    ),
    false
  );
});

test("Core FPS lifecycle cutoffs and result messages remain deterministic", () => {
  const cutoffs = coreFpsLifecycleCutoffs(now);

  assert.equal(cutoffs.activeSession.getTime(), now.getTime() - coreFpsSessionPresenceWindowMs);
  assert.equal(cutoffs.launchedSession.getTime(), now.getTime() - coreFpsSessionLaunchGraceWindowMs);
  assert.equal(
    buildCoreFpsResultBody({
      leader: {
        damage: 900,
        deaths: 2,
        displayName: "Reload",
        flags: 1,
        frags: 7,
        score: 975,
        userId: "user-123"
      },
      mapName: "dust2",
      playerCount: 2
    }),
    "Core FPS on dust2 finished with 2 players. Reload led the match with 975 points and 7 frags."
  );
});

test("Core FPS gateway authenticates play surfaces and blocks the arbitrary proxy", async () => {
  const gateway = await readFile(new URL("../services/core-fps/gateway/default.conf.template", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../services/core-fps/runtime/core.yaml", import.meta.url), "utf8");
  const runtimeDockerfile = await readFile(new URL("../services/core-fps/runtime/Dockerfile", import.meta.url), "utf8");
  const runtimeIndex = await readFile(new URL("../services/core-fps/runtime/index.html", import.meta.url), "utf8");
  const runtimePatch = await readFile(new URL("../services/core-fps/runtime/solo-bot.patch", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/app/games/core/play/page.tsx", import.meta.url), "utf8");
  const frame = await readFile(new URL("../src/app/games/core/play/core-fps-game-frame.tsx", import.meta.url), "utf8");
  const pip = await readFile(new URL("../src/app/games/core/play/core-fps-live-pip.tsx", import.meta.url), "utf8");

  assert.match(gateway, /location \^~ \/service\/proxy\//);
  assert.match(gateway, /auth_request \/_core_auth/);
  assert.match(gateway, /X-Core-Gateway-Secret/);
  assert.match(gateway, /return 302 \$core_launch_redirect/);
  assert.match(gateway, /cmd=\$arg_cmd&lobbyMap=\$arg_lobbyMap/);
  assert.match(gateway, /X-Core-Session-Id \$core_session_id/);
  assert.match(gateway, /frame-ancestors \$\{CORE_FPS_PARENT_ORIGIN\}/);
  assert.match(gateway, /location \/ \{\s+auth_request \/_core_auth;/);
  assert.match(gateway, /location \/ \{[\s\S]*?proxy_buffering off;/);
  assert.match(gateway, /location ~ \^\/worker\\\.\[a-f0-9\]\+\\\.js\$/);
  assert.match(gateway, /Math\.min\(1e4,1e3\*\(r\+1\)\)/);
  assert.match(gateway, /sessionStorage\.removeItem\("coreWsRetry"\)/);
  assert.match(gateway, /s\.onclose=/);
  assert.match(gateway, /_bouncecoreInput/);
  assert.match(gateway, /requestPointerLock/);
  assert.match(frame, /sandbox="allow-downloads allow-fullscreen allow-pointer-lock allow-same-origin allow-scripts"/);
  assert.match(frame, /frameRef\.current\?\.focus\(\)/);
  assert.match(frame, /tabIndex=\{0\}/);
  assert.match(frame, /CoreFpsLivePip/);
  assert.match(pip, /data-live-primary-video-slot="true"/);
  assert.match(pip, /subscribeToLiveStatus/);
  assert.match(runtime, /default: true/);
  assert.match(runtime, /alias: "lobby"/);
  assert.match(runtime, /votingCreates: false[\s\S]*?alias: "lobby"/);
  assert.match(runtime, /guibutton \\"Play Bouncecore arena\\" \\"join lobby\\"/);
  assert.match(runtimeDockerfile, /core-index\.html/);
  assert.match(runtimeDockerfile, /go test -vet=off \.\/pkg\/gameserver \.\/pkg\/gameserver\/relay/);
  assert.match(runtimeDockerfile, /\/game\/api\.js --output \/tmp\/core-game\/api\.js/);
  assert.match(runtimeDockerfile, /\/game\/sauerbraten\.js --output \/tmp\/core-game\/sauerbraten\.js/);
  assert.match(runtimeDockerfile, /\/game\/sauerbraten\.wasm --output \/tmp\/core-game\/sauerbraten\.wasm/);
  assert.match(runtimeDockerfile, /COPY --from=runtime-release \/tmp\/core-game \/src\/pkg\/server\/static\/site\/game/);
  assert.match(runtimeDockerfile, /test -s \/tmp\/core-game\/sauerbraten\.wasm/);
  assert.match(runtimeDockerfile, /static\/site\/index\.html/);
  assert.match(runtimeIndex, /<div id="root"><\/div>/);
  assert.match(runtimeIndex, /var Module = typeof Module !== "undefined" \? Module : \{\}/);
  assert.match(runtimeIndex, /Module\.noInitialRun = true/);
  assert.match(runtimeIndex, /var WASM_PROMISE = new Promise/);
  assert.match(runtimeIndex, /<script src="\/index\.js"><\/script>/);
  assert.match(runtimeIndex, /<script async src="\/game\/api\.js"><\/script>/);
  assert.match(runtimeIndex, /<script async src="\/game\/sauerbraten\.js"><\/script>/);
  assert.doesNotMatch(runtimeIndex, /<pre>/);
  assert.match(runtimePatch, /pendingLobbyMap/);
  assert.match(runtimePatch, /CubeMessageType\.N_WELCOME/);
  assert.match(runtimePatch, /\[500, 1500, 3000\]/);
  assert.match(runtimePatch, /duplicateLobbyBootstrap/);
  assert.match(runtimePatch, /TestOwnedClientPacketsReachObserversButDoNotEchoToOwner/);
  assert.match(runtimePatch, /client\.State != playerstate\.Spectator/);
  assert.match(runtimePatch, /botRespawnTicker := time\.NewTicker/);
  assert.match(runtimePatch, /func \(s \*Server\) respawnDeadSoloBots/);
  assert.match(runtimePatch, /TestDeadSoloBotRespawnsAfterDelay/);
  assert.match(runtimePatch, /diff --git a\/pkg\/gameserver\/solo_bot\.go/);
  assert.doesNotMatch(launcher, /CORE_FPS_TICKET_SECRET/);
});

test("Core FPS is exposed as a separate shared game to signed-in chat users", async () => {
  const chatPage = await readFile(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");
  const chatPanel = await readFile(new URL("../src/app/chat/chat-room-panel.tsx", import.meta.url), "utf8");
  const coreHub = await readFile(new URL("../src/app/games/core/page.tsx", import.meta.url), "utf8");
  const coreLauncher = await readFile(new URL("../src/app/games/core/play/page.tsx", import.meta.url), "utf8");
  const lobbyStage = await readFile(
    new URL("../src/app/games/core/play/core-fps-lobby-stage.tsx", import.meta.url),
    "utf8"
  );
  const lobbyRoute = await readFile(
    new URL("../src/app/api/games/core/lobbies/[lobbyId]/route.ts", import.meta.url),
    "utf8"
  );
  const inviteRoute = await readFile(
    new URL("../src/app/api/games/core/lobbies/[lobbyId]/invite/route.ts", import.meta.url),
    "utf8"
  );
  const lobbyService = await readFile(
    new URL("../src/lib/games/core-fps-lobby-service.ts", import.meta.url),
    "utf8"
  );
  const inviteService = await readFile(
    new URL("../src/lib/games/core-fps-invite-service.ts", import.meta.url),
    "utf8"
  );

  assert.match(chatPage, /getPublicCoreFpsSettings/);
  assert.match(chatPage, /coreFpsEnabled=\{coreFpsSettings\.enabled\}/);
  assert.match(chatPanel, /Start the shared Core FPS game and invite every online chatter/);
  assert.match(chatPanel, /name="intent" type="hidden" value="core-fps"/);
  assert.match(chatPanel, /window\.location\.assign\(state\.actionUrl\)/);
  assert.match(chatPanel, /\{coreFpsEnabled \? \(/);
  assert.match(coreHub, /href="\/games\/core\/play"/);
  assert.match(coreHub, /All-time leaderboard/);
  assert.match(coreHub, /How scoring works/);
  assert.match(coreHub, /Controls/);
  assert.match(coreLauncher, /requireSignedInUser\(\)/);
  assert.match(coreLauncher, /joinCoreFpsLobby/);
  assert.match(coreLauncher, /CoreFpsLobbyStage/);
  assert.match(lobbyStage, /Players are joining/);
  assert.match(lobbyStage, /Invite all/);
  assert.match(lobbyStage, /CoreFpsGameFrame/);
  assert.match(lobbyStage, /setInterval/);
  assert.match(lobbyStage, /navigator\.sendBeacon/);
  assert.match(lobbyStage, /Leave lobby/);
  assert.match(lobbyRoute, /getCoreFpsLobbyState/);
  assert.match(lobbyRoute, /leaveCoreFpsLobby/);
  assert.match(lobbyRoute, /export async function POST/);
  assert.match(inviteRoute, /sendCoreFpsLobbyInvites/);
  assert.match(lobbyService, /export async function leaveCoreFpsLobby/);
  assert.match(lobbyService, /leftAt: null/);
  assert.match(inviteService, /coreFpsLobbyPresenceWindowMs/);
  assert.match(inviteService, /leftAt: null/);
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
  const lifecycleService = await readFile(
    new URL("../src/lib/games/core-fps-reconciliation-service.ts", import.meta.url),
    "utf8"
  );
  const worker = await readFile(new URL("../src/workers/main.ts", import.meta.url), "utf8");

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
  assert.match(lifecycleService, /core-fps-result/);
  assert.match(lifecycleService, /status: "disconnected"/);
  assert.match(lifecycleService, /publishChatRoomChanged/);
  assert.match(worker, /core-fps-lifecycle-reconcile/);
  assert.match(worker, /WORKER_CORE_FPS_RECONCILE_INTERVAL_SECONDS/);
});
