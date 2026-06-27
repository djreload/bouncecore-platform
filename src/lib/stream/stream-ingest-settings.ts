export function getConfiguredRtmpIngestUrl() {
  const ingestUrl = process.env.RTMP_INGEST_URL?.trim();

  return ingestUrl || null;
}
