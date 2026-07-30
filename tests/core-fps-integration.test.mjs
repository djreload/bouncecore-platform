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
  buildCoreFpsMatchChoices,
  buildCoreFpsMatchVoteOptions,
  coreFpsModeDefinition,
  coreFpsMapDefinition,
  coreFpsReadyCountdownSeconds,
  coreFpsLobbyIsReusable,
  coreFpsLobbyShouldStart,
  coreFpsMapsForMode,
  migrateCoreFpsMapPool,
  normalizeCoreFpsLobbyWaitSeconds,
  normalizeCoreFpsMapPool,
  normalizeCoreFpsModePool,
  pickRandomCoreFpsMap,
  resolveCoreFpsMatchVote,
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
  assert.equal(
    new URL(
      buildCoreFpsLaunchUrl(
        "https://core.example.com",
        "payload.signature",
        "Reload-a1b2c3",
        "complex",
        "teamplay"
      )
    ).searchParams.get("cmd"),
    "name Reload-a1b2c3; join lobby-tdm"
  );
  assert.equal(
    new URL(
      buildCoreFpsLaunchUrl(
        "https://core.example.com",
        "payload.signature",
        "Reload-a1b2c3",
        "turbine",
        "ctf"
      )
    ).searchParams.get("cmd"),
    "name Reload-a1b2c3; join lobby-ctf"
  );
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
  assert.deepEqual(migrateCoreFpsMapPool(["complex", "dust2", "turbine"], undefined), [
    "neonvault",
    "complex",
    "dust2",
    "turbine"
  ]);
  assert.deepEqual(migrateCoreFpsMapPool(["complex", "dust2", "turbine"], 2), [
    "complex",
    "dust2",
    "turbine"
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

test("Core FPS lobby voting resolves configured maps and modes deterministically", () => {
  assert.deepEqual(normalizeCoreFpsModePool(["CTF", "ffa", "ctf", "not-a-mode"]), [
    "ffa",
    "ctf"
  ]);
  assert.deepEqual(normalizeCoreFpsModePool([]), ["ffa", "teamplay", "ctf"]);
  assert.equal(coreFpsModeDefinition("teamplay").displayName, "Team Deathmatch");
  assert.equal(coreFpsModeDefinition("ctf").runtimeAlias, "lobby-ctf");
  assert.deepEqual(
    coreFpsMapsForMode(["complex", "dust2", "neonvault", "turbine", "xmwhub"], "ctf"),
    ["dust2", "neonvault", "xmwhub"]
  );
  assert.deepEqual(coreFpsMapDefinition("neonvault"), {
    displayName: "Neon Vault",
    id: "neonvault",
    supportedModes: ["ffa", "teamplay", "ctf"]
  });
  const choices = buildCoreFpsMatchChoices(
    "lobby-vote-test",
    ["complex", "dust2", "neonvault", "turbine", "xmwhub"],
    ["ffa", "teamplay", "ctf"]
  );

  assert.equal(choices.length, 2);
  assert.deepEqual(
    choices,
    buildCoreFpsMatchChoices(
      "lobby-vote-test",
      ["complex", "dust2", "neonvault", "turbine", "xmwhub"],
      ["ffa", "teamplay", "ctf"]
    )
  );
  assert.notEqual(choices[0].mapName, choices[1].mapName);
  assert.notEqual(choices[0].modeName, choices[1].modeName);
  assert.ok(
    choices.every((choice) =>
      coreFpsMapsForMode(
        ["complex", "dust2", "neonvault", "turbine", "xmwhub"],
        choice.modeName
      ).includes(choice.mapName)
    )
  );

  const votes = [
    { mapVote: choices[1].mapName, modeVote: choices[1].modeName },
    { mapVote: choices[1].mapName, modeVote: choices[1].modeName },
    { mapVote: choices[0].mapName, modeVote: choices[0].modeName },
    { mapVote: "invalid", modeVote: "ctf" }
  ];
  assert.equal(
    resolveCoreFpsMatchVote(choices, votes, choices[0]).id,
    choices[1].id
  );
  assert.deepEqual(
    buildCoreFpsMatchVoteOptions(choices, votes, votes[1]).map(
      ({ id, selected, votes: voteCount }) => ({ id, selected, votes: voteCount })
    ),
    [
      { id: choices[0].id, selected: false, votes: 1 },
      { id: choices[1].id, selected: true, votes: 2 }
    ]
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
      modeName: "ctf",
      playerCount: 2
    }),
    "Core FPS Capture the Flag on dust2 finished with 2 players. Reload led the match with 975 points and 7 frags."
  );
});

test("Core FPS gateway authenticates play surfaces and blocks the arbitrary proxy", async () => {
  const gateway = await readFile(new URL("../services/core-fps/gateway/default.conf.template", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../services/core-fps/runtime/core.yaml", import.meta.url), "utf8");
  const runtimeDockerfile = await readFile(new URL("../services/core-fps/runtime/Dockerfile", import.meta.url), "utf8");
  const runtimeIndex = await readFile(new URL("../services/core-fps/runtime/index.html", import.meta.url), "utf8");
  const runtimePatch = await readFile(new URL("../services/core-fps/runtime/solo-bot.patch", import.meta.url), "utf8");
  const arenaPatch = await readFile(
    new URL("../services/core-fps/runtime/neon-vault-map.patch", import.meta.url),
    "utf8"
  );
  const arenaGenerator = await readFile(
    new URL("../services/core-fps/runtime/neon_vault_map.go", import.meta.url),
    "utf8"
  );
  const arenaInstaller = await readFile(
    new URL("../services/core-fps/runtime/install_neon_vault.py", import.meta.url),
    "utf8"
  );
  const flagBranding = await readFile(
    new URL("../services/core-fps/runtime/brand_flags.py", import.meta.url),
    "utf8"
  );
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
  assert.match(gateway, /map \$uri \$core_cache_control \{[\s\S]*?"\/" "no-cache, no-store, must-revalidate"/);
  assert.match(gateway, /map \$uri \$core_cache_control \{[\s\S]*?~\^\/game\/ "no-cache, no-store, must-revalidate"/);
  assert.match(gateway, /add_header Set-Cookie \$core_ticket_cookie always;\s+add_header Cache-Control \$core_cache_control always;/);
  assert.match(gateway, /add_header Expires \$core_expires always;/);
  assert.doesNotMatch(gateway, /location = \/ \{\s+access_log off;\s+add_header/);
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
  assert.match(runtime, /defaultMode: "teamplay"[\s\S]*?alias: "lobby-tdm"/);
  assert.match(runtime, /defaultMode: "ctf"[\s\S]*?alias: "lobby-ctf"/);
  assert.match(
    runtime,
    /defaultMode: "ctf"[\s\S]*?maps:\s+- "neonvault"\s+- "dust2"\s+- "xmwhub"/
  );
  assert.match(runtimeDockerfile, /neon-vault-map\.patch/);
  assert.match(runtimeDockerfile, /go run \.\/cmd\/neonvault --output \/out\/neonvault\.ogz/);
  assert.match(arenaPatch, /p\.Put\(-int32\(numVSlots\)\)/);
  assert.match(arenaGenerator, /func verifyNeonVault/);
  assert.match(arenaGenerator, /playerStarts != 14 \|\| flags != 2/);
  assert.match(arenaGenerator, /func addBouncecoreWallMural/);
  assert.match(arenaGenerator, /func addBlockWord/);
  assert.match(arenaGenerator, /func addBlockTree/);
  assert.match(arenaGenerator, /func addWestClubHouse/);
  assert.match(arenaGenerator, /func addEastClubHouse/);
  assert.match(arenaGenerator, /textureGrass/);
  assert.match(arenaGenerator, /textureWood/);
  assert.match(arenaGenerator, /textureLeaves/);
  assert.match(arenaGenerator, /textureDoor/);
  assert.match(arenaGenerator, /textureBooth/);
  assert.match(arenaGenerator, /"BOUNCE"/);
  assert.match(arenaGenerator, /"CORE"/);
  assert.match(arenaInstaller, /make_grass\(\)/);
  assert.match(arenaInstaller, /make_dirt\(\)/);
  assert.match(arenaInstaller, /make_stone\(\)/);
  assert.match(arenaInstaller, /make_wood\(\)/);
  assert.match(arenaInstaller, /make_leaves\(\)/);
  assert.match(arenaInstaller, /make_door\(\)/);
  assert.match(arenaInstaller, /make_speaker\(\)/);
  assert.match(arenaInstaller, /make_booth\(\)/);
  assert.doesNotMatch(arenaInstaller, /DANCEFLOOR|CYAN CLUB|PINK CLUB/);
  assert.match(arenaInstaller, /"desktop": False/);
  assert.match(arenaInstaller, /"web": False/);
  assert.match(runtime, /votingCreates: false[\s\S]*?alias: "lobby"/);
  assert.match(runtime, /guibutton \\"Play Bouncecore arena\\" \\"join lobby\\"/);
  assert.match(runtimeDockerfile, /core-index\.html/);
  assert.match(runtimeDockerfile, /go test -vet=off \.\/pkg\/gameserver \.\/pkg\/gameserver\/relay/);
  assert.match(runtimeDockerfile, /FROM emscripten\/emsdk:2\.0\.34 AS game-builder/);
  assert.match(runtimeDockerfile, /--include=game\/src\/fpsgame\/ai\.cpp/);
  assert.match(runtimeDockerfile, /--include=game\/src\/engine\/rendergl\.cpp/);
  assert.match(runtimeDockerfile, /GAME_OUTPUT_DIR=\/out\/game bash game\/build/);
  assert.match(runtimeDockerfile, /COPY --from=game-builder \/out\/game \/src\/pkg\/server\/static\/site\/game/);
  assert.match(runtimeDockerfile, /static\/site\/index\.html/);
  assert.match(runtimeDockerfile, /brand_flags\.py/);
  assert.match(runtimeDockerfile, /python3 \/tmp\/brand_flags\.py/);
  assert.match(flagBranding, /models\/flags\/red\/skin\.jpg/);
  assert.match(flagBranding, /models\/flags\/blue\/skin\.jpg/);
  assert.match(flagBranding, /BOUNCECORE/);
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
  assert.match(runtimePatch, /Module\.postLoadWorld[\s\S]*?\[750, 1750, 3250\]/);
  assert.match(runtimePatch, /lobbyWelcomeReceived = true/);
  assert.match(runtimePatch, /duplicateLobbyBootstrap/);
  assert.match(runtimePatch, /lobbyBootstrap && mapname == s\.Map && modeID == s\.GameMode\.ID\(\)/);
  assert.match(runtimePatch, /bouncecore-sour-blobs-v2/);
  assert.match(runtimePatch, /await deleteBlob\(id\)/);
  assert.match(runtimePatch, /ok && !flagMode\.NeedsMapInfo\(\)/);
  assert.match(runtimePatch, /m\.s\.Broadcast\(m\.FlagsInitPacket\(\)\)/);
  assert.match(runtimePatch, /func handlingFlags\(s Server, fm flagMode\)/);
  assert.match(
    runtimePatch,
    /DELAY_AFTER_LOAD[\s\S]*?CubeMessageType\.N_ITEMLIST,[\s\S]*?CubeMessageType\.N_SPAWN,[\s\S]*?CubeMessageType\.N_INITFLAGS/
  );
  assert.match(runtimePatch, /TestOwnedClientPacketsReachObserversButDoNotEchoToOwner/);
  assert.match(runtimePatch, /client\.State != playerstate\.Spectator/);
  assert.match(runtimePatch, /botRespawnTicker := time\.NewTicker/);
  assert.match(runtimePatch, /func \(s \*Server\) respawnDeadSoloBots/);
  assert.match(runtimePatch, /TestDeadSoloBotRespawnsAfterDelay/);
  assert.match(runtimePatch, /MAX_MOBILE_RENDER_PIXELS = 1920 \* 1080/);
  assert.match(runtimePatch, /MAX_MOBILE_PIXEL_RATIO = 1\.35/);
  assert.match(runtimePatch, /const renderScale = Math\.min\(requestedPixelRatio, pixelBudgetRatio\)/);
  assert.match(runtimePatch, /webglcontextrestored/);
  assert.match(runtimePatch, /const MOTION_FACTOR = 2/);
  assert.match(runtimePatch, /if\(dx < -128 \|\| dx > 128 \|\| dy < -128 \|\| dy > 128\) return/);
  assert.match(runtimePatch, /dx = clamp\(dx, -64, 64\)/);
  assert.match(runtimePatch, /FVARP\(sensitivity, 1e-3f, 5, 1000\)/);
  assert.match(runtimePatch, /BananaBread\.execute\('maxfps 60'\)/);
  assert.match(runtimePatch, /BananaBread\.execute\('sensitivity 5'\)/);
  assert.match(runtimePatch, /b\.type == AI_S_PURSUE && b\.targtype == AI_T_PLAYER/);
  assert.match(runtimePatch, /d->ai->spot = pursuit->feetpos\(\)/);
  assert.match(runtimePatch, /bool recoverpursuit\(fpsent \*d, aistate &b\)/);
  assert.match(runtimePatch, /if\(recoverpursuit\(d, b\)\) return/);
  assert.match(runtimePatch, /diff --git a\/client\/src\/GameHud\.tsx/);
  assert.match(runtimePatch, /aria-label="Player status"/);
  assert.match(runtimePatch, /diff --git a\/pkg\/gameserver\/solo_bot\.go/);
  assert.doesNotMatch(launcher, /CORE_FPS_TICKET_SECRET/);
  assert.match(gateway, /resolver 127\.0\.0\.11 valid=10s ipv6=off/);
  assert.match(gateway, /set \$core_app_upstream "http:\/\/\$\{CORE_FPS_APP_UPSTREAM\}"/);
  assert.match(gateway, /proxy_pass \$core_app_upstream\/api\/internal\/games\/core\/auth/);
  assert.match(gateway, /proxy_pass \$core_runtime_upstream/);
  assert.match(gateway, /proxy_pass \$core_websocket_upstream/);
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
  const voteRoute = await readFile(
    new URL("../src/app/api/games/core/lobbies/[lobbyId]/vote/route.ts", import.meta.url),
    "utf8"
  );
  const launchRoute = await readFile(
    new URL("../src/app/api/games/core/lobbies/[lobbyId]/launch/route.ts", import.meta.url),
    "utf8"
  );
  const lobbyService = await readFile(
    new URL("../src/lib/games/core-fps-lobby-service.ts", import.meta.url),
    "utf8"
  );
  const lobbyMigration = await readFile(
    new URL("../prisma/migrations/0046_add_core_fps_lobby_voting/migration.sql", import.meta.url),
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
  assert.match(lobbyStage, /Choose the next match/);
  assert.match(lobbyStage, /One choice per player/);
  assert.match(lobbyStage, /previewImageUrl/);
  assert.match(lobbyStage, /\/vote/);
  assert.match(lobbyStage, /\/launch/);
  assert.match(lobbyStage, /Invite all/);
  assert.match(lobbyStage, /CoreFpsGameFrame/);
  assert.match(lobbyStage, /setInterval/);
  assert.match(lobbyStage, /navigator\.sendBeacon/);
  assert.match(lobbyStage, /Leave lobby/);
  assert.match(lobbyRoute, /getCoreFpsLobbyState/);
  assert.match(lobbyRoute, /leaveCoreFpsLobby/);
  assert.match(lobbyRoute, /export async function POST/);
  assert.match(inviteRoute, /sendCoreFpsLobbyInvites/);
  assert.match(voteRoute, /castCoreFpsLobbyVote/);
  assert.match(launchRoute, /getCoreFpsLobbyForLaunch/);
  assert.match(launchRoute, /createCoreFpsLaunch/);
  assert.match(lobbyService, /export async function leaveCoreFpsLobby/);
  assert.match(lobbyService, /buildCoreFpsMatchChoices/);
  assert.match(lobbyService, /coreFpsMatchChoiceId/);
  assert.match(lobbyService, /mapVote: choice\.mapName/);
  assert.match(lobbyService, /modeVote: choice\.modeName/);
  assert.match(lobbyService, /leftAt: null/);
  assert.match(lobbyMigration, /"mapVote"/);
  assert.match(lobbyMigration, /"modeVote"/);
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
