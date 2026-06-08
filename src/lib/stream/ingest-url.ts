const encodedStreamKeyPlaceholders = ["{streamKey}", "{stream_key}", "{key}", "{streamKeyEncoded}"];
const rawStreamKeyPlaceholders = ["{streamKeyRaw}", "{rawStreamKey}"];

function replaceEvery(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [token, replacement]) => result.split(token).join(replacement), value);
}

export function hasStreamKeyPlaceholder(value: string) {
  return [...encodedStreamKeyPlaceholders, ...rawStreamKeyPlaceholders].some((placeholder) => value.includes(placeholder));
}

export function maskIngestUrl(value: string) {
  return replaceEvery(value, {
    "{key}": "STREAM_KEY",
    "{rawStreamKey}": "STREAM_KEY",
    "{streamKey}": "STREAM_KEY",
    "{streamKeyEncoded}": "STREAM_KEY",
    "{streamKeyRaw}": "STREAM_KEY",
    "{stream_key}": "STREAM_KEY"
  });
}

export function resolveIngestUrlTemplate(value: string, rawStreamKey: string) {
  const encodedStreamKey = encodeURIComponent(rawStreamKey);

  return replaceEvery(value, {
    "{key}": encodedStreamKey,
    "{rawStreamKey}": rawStreamKey,
    "{streamKey}": encodedStreamKey,
    "{streamKeyEncoded}": encodedStreamKey,
    "{streamKeyRaw}": rawStreamKey,
    "{stream_key}": encodedStreamKey
  });
}
