const sensitivePathKey = /^(chunk_path|model_path|model_dir|audio_path)$/i;
const absolutePath = /(?:\b[A-Z]:\\[^\s"']*|\\\\[^\s"']+|\/(?:Users|home|tmp|var)\/[^\s"']*)/gi;

export function sanitizeText(text: string): string {
  return text.replace(absolutePath, "[path hidden]");
}

export function sanitizePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sensitivePathKey.test(key) ? "[path hidden]" : sanitizePayload(nested)]));
  }
  return typeof value === "string" ? sanitizeText(value) : value;
}

export function sanitizedJson(value: unknown): string {
  return JSON.stringify(sanitizePayload(value), null, 2);
}
