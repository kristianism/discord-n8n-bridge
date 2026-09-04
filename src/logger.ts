import { configSecrets } from "./config.js";
import { redactSecrets, redactUrl } from "./redact.js";
import type { AppConfig, LogLevel, Logger } from "./types.js";
import { SERVICE_NAME } from "./version.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function sanitizeValue(value: unknown, extraSecrets: readonly string[]): unknown {
  if (typeof value === "string") {
    return redactSecrets(value, extraSecrets);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, extraSecrets));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nested]) => [key, sanitizeValue(nested, extraSecrets)] as const,
    );
    return Object.fromEntries(entries);
  }
  return value;
}

export function createLogger(
  config: Pick<AppConfig, "instanceId" | "logLevel" | "discordBotToken" | "n8nAuthHeaderValue">,
  write: (line: string) => void = (line) => {
    process.stdout.write(`${line}\n`);
  },
): Logger {
  const secrets = configSecrets(config);
  const minRank = LEVEL_RANK[config.logLevel];

  function log(level: LogLevel, fields: Record<string, unknown>, message: string): void {
    if (LEVEL_RANK[level] < minRank) {
      return;
    }
    const record: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      service: SERVICE_NAME,
      instance_id: config.instanceId,
      msg: redactSecrets(message, secrets),
    };
    for (const [key, value] of Object.entries(fields)) {
      if (key === "webhook_url" && typeof value === "string") {
        record[key] = redactUrl(value);
        continue;
      }
      record[key] = sanitizeValue(value, secrets);
    }
    write(JSON.stringify(record));
  }

  return {
    debug(fields, message) {
      log("debug", fields, message);
    },
    info(fields, message) {
      log("info", fields, message);
    },
    warn(fields, message) {
      log("warn", fields, message);
    },
    error(fields, message) {
      log("error", fields, message);
    },
  };
}
