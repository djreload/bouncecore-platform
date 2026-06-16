const pathPlaceholders = ["{path}", "{streamPath}", "{stream_path}"];
const rawPathPlaceholders = ["{pathRaw}", "{streamPathRaw}", "{rawStreamPath}"];

function replaceEvery(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [token, replacement]) => result.split(token).join(replacement), value);
}

function encodeStreamPath(path: string) {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function resolveTranscoderSourceUrlTemplate(template: string, streamPath: string) {
  const trimmedTemplate = template.trim();
  const normalizedPath = streamPath.trim().replace(/^\/+|\/+$/g, "") || "live";
  const encodedPath = encodeStreamPath(normalizedPath);

  return replaceEvery(trimmedTemplate, {
    "{path}": encodedPath,
    "{pathRaw}": normalizedPath,
    "{rawStreamPath}": normalizedPath,
    "{streamPath}": encodedPath,
    "{streamPathRaw}": normalizedPath,
    "{stream_path}": encodedPath
  });
}

export function hasTranscoderPathPlaceholder(template: string) {
  return [...pathPlaceholders, ...rawPathPlaceholders].some((placeholder) => template.includes(placeholder));
}
