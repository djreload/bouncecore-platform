const encodedStreamKeyPlaceholders = ["{streamKey}", "{stream_key}", "{key}", "{streamKeyEncoded}"];
const rawStreamKeyPlaceholders = ["{streamKeyRaw}", "{rawStreamKey}"];
const streamKeyPlaceholders = [...encodedStreamKeyPlaceholders, ...rawStreamKeyPlaceholders];
const streamKeySidecarParams = ["user", "username"];

function replaceEvery(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [token, replacement]) => result.split(token).join(replacement), value);
}

function decodeUrlPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function includesStreamKeyPlaceholder(value: string) {
  const decoded = decodeUrlPart(value);
  return streamKeyPlaceholders.some((placeholder) => value.includes(placeholder) || decoded.includes(placeholder));
}

function stripStreamKeyPathSegments(pathname: string) {
  return (
    pathname
      .split("/")
      .filter((segment) => !includesStreamKeyPlaceholder(segment))
      .join("/") || "/"
  );
}

export function hasStreamKeyPlaceholder(value: string) {
  return includesStreamKeyPlaceholder(value);
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

export function obsServerUrlFromIngestUrl(value: string) {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    let removedStreamKeyQueryParam = false;

    for (const [name, paramValue] of Array.from(url.searchParams.entries())) {
      if (includesStreamKeyPlaceholder(name) || includesStreamKeyPlaceholder(paramValue)) {
        url.searchParams.delete(name);
        removedStreamKeyQueryParam = true;
      }
    }

    if (removedStreamKeyQueryParam) {
      for (const param of streamKeySidecarParams) {
        url.searchParams.delete(param);
      }
    }

    url.pathname = stripStreamKeyPathSegments(url.pathname);
    return url.toString().replace(/\?$/, "");
  } catch {
    return stripStreamKeyPathSegments(maskIngestUrl(trimmed).split("?")[0]);
  }
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
