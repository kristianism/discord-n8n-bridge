import type { EnvSource } from "./config.js";
import { ConfigError } from "./errors.js";
import { redactSecrets, toLogError } from "./redact.js";

export function startupSecretsFromEnv(env: EnvSource): string[] {
  return [
    env["DISCORD_BOT_TOKEN"] ?? "",
    env["N8N_AUTH_HEADER_VALUE"] ?? "",
  ].filter((secret) => secret.length > 0);
}

export function formatStartupError(
  error: unknown,
  secrets: readonly string[],
): string {
  if (error instanceof ConfigError) {
    return JSON.stringify({
      level: "error",
      msg: redactSecrets(error.message, secrets),
    });
  }

  return JSON.stringify({
    level: "error",
    msg: "fatal startup error",
    err: toLogError(error, secrets),
  });
}
