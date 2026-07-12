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

  test(`${composeFile} enforces restream keyframes for external RTMP platforms`, () => {
    const content = readFileSync(join(process.cwd(), composeFile), "utf8");

    assert.match(content, /RESTREAM_TRANSCODE: \$\{RESTREAM_TRANSCODE:-true\}/);
    assert.match(content, /RESTREAM_KEYFRAME_SECONDS: \$\{RESTREAM_KEYFRAME_SECONDS:-2\}/);
    assert.match(content, /RESTREAM_VIDEO_FPS: \$\{RESTREAM_VIDEO_FPS:-30\}/);
    assert.match(content, /-c:v libx264/);
    assert.match(content, /-g "\$\$restream_gop"/);
    assert.match(content, /-keyint_min "\$\$restream_gop"/);
    assert.match(content, /-sc_threshold 0/);
    assert.match(content, /-force_key_frames "expr:gte\(t,n_forced\*\$\$RESTREAM_KEYFRAME_SECONDS\)"/);
    assert.match(content, /RESTREAM_TRANSCODE:-true/);
  });
}
