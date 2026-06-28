import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const composeFiles = ["docker-compose.instance.yml", "docker-compose.staging.yml"];

for (const composeFile of composeFiles) {
  test(`${composeFile} writes rolling live HLS playlists`, () => {
    const content = readFileSync(join(process.cwd(), composeFile), "utf8");

    assert.match(content, /-hls_flags [^\n]*omit_endlist/, "live playlists must not emit EXT-X-ENDLIST while OBS is connected");
    assert.match(content, /-hls_segment_type mpegts/, "MPEG-TS segments are more tolerant for long-running live playback");
    assert.match(content, /-hls_start_number_source epoch/, "epoch sequence numbers avoid browser cache collisions after reconnects");
    assert.doesNotMatch(content, /-hls_segment_type fmp4/, "fMP4 live segments previously caused finite-playback failures");
  });
}
