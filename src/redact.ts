const DISCORD_BOT_TOKEN_PATTERN = /[\w-]{24}\.[\w-]{6}\.[\w-]{27,}/g;
const BEARER_OR_BOT_PATTERN = /\b(?:Bot|Bearer)\s+\S+/gi;

export function redactSecrets(
  text: string,
  extraSecrets: readonly string[] = [],
): string {
  let redacted = text;
  for (const secret of extraSecrets) {
    if (secret.length >= 8) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }
  redacted = redacted.replace(DISCORD_BOT_TOKEN_PATTERN, "[redacted]");
  redacted = redacted.replace(BEARER_OR_BOT_PATTERN, "[redacted]");
  return redacted;
}

export function redactUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "[unparseable-url]";
  }
}

export function toLogError(
  error: unknown,
  extraSecrets: readonly string[] = [],
): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSecrets(error.message, extraSecrets),
    };
  }
  return {
    name: "Error",
    message: redactSecrets(String(error), extraSecrets),
  };
}
