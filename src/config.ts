import { z } from "zod";
import { ConfigError } from "./errors.js";
import type { AppConfig, LogLevel, NodeEnv } from "./types.js";

const SNOWFLAKE = /^\d{17,20}$/;
const INSTANCE_ID = /^[A-Za-z0-9._-]+$/;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

const snowflakeId = z
  .string()
  .regex(SNOWFLAKE, { error: "must be a Discord snowflake id" });

const snowflakeList = z
  .string()
  .default("")
  .transform((raw) =>
    raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  )
  .pipe(z.array(snowflakeId));

const boolEnv = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return "false";
  }
  return value;
}, z.stringbool());

function numericEnv(defaultValue: number): z.ZodType<number, unknown> {
  return z.preprocess((value) => {
    if (value === undefined || value === "") {
      return defaultValue;
    }
    return value;
  }, z.coerce.number().int().positive());
}

const envSchema = z.object({
  BRIDGE_INSTANCE_ID: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(INSTANCE_ID, { error: "use letters, numbers, dots, underscores, or hyphens" }),
  DISCORD_BOT_TOKEN: z.string().trim().min(1),
  N8N_WEBHOOK_URL: z.string().trim().min(1),
  N8N_AUTH_HEADER_NAME: z.preprocess(
    (value) =>
      value === undefined || value === "" ? "X-Discord-Ingress-Key" : value,
    z.string().trim().regex(HEADER_NAME),
  ),
  N8N_AUTH_HEADER_VALUE: z.string().min(1),
  DISCORD_GUILD_IDS: snowflakeList,
  DISCORD_CHANNEL_IDS: snowflakeList,
  DISCORD_ENABLE_DIRECT_MESSAGES: boolEnv,
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HTTP_TIMEOUT_MS: numericEnv(10_000),
  RETRY_MAX_ATTEMPTS: numericEnv(5).pipe(z.number().int().min(1).max(20)),
  RETRY_BASE_DELAY_MS: numericEnv(1_000),
  MAX_IN_FLIGHT_DELIVERIES: numericEnv(32).pipe(z.number().int().min(1).max(1000)),
});

export type EnvSource = Record<string, string | undefined>;

function readEnv(env: EnvSource): Record<string, string | undefined> {
  return {
    BRIDGE_INSTANCE_ID: env["BRIDGE_INSTANCE_ID"],
    DISCORD_BOT_TOKEN: env["DISCORD_BOT_TOKEN"],
    N8N_WEBHOOK_URL: env["N8N_WEBHOOK_URL"],
    N8N_AUTH_HEADER_NAME: env["N8N_AUTH_HEADER_NAME"],
    N8N_AUTH_HEADER_VALUE: env["N8N_AUTH_HEADER_VALUE"],
    DISCORD_GUILD_IDS: env["DISCORD_GUILD_IDS"],
    DISCORD_CHANNEL_IDS: env["DISCORD_CHANNEL_IDS"],
    DISCORD_ENABLE_DIRECT_MESSAGES: env["DISCORD_ENABLE_DIRECT_MESSAGES"],
    NODE_ENV: env["NODE_ENV"],
    LOG_LEVEL: env["LOG_LEVEL"],
    HTTP_TIMEOUT_MS: env["HTTP_TIMEOUT_MS"],
    RETRY_MAX_ATTEMPTS: env["RETRY_MAX_ATTEMPTS"],
    RETRY_BASE_DELAY_MS: env["RETRY_BASE_DELAY_MS"],
    MAX_IN_FLIGHT_DELIVERIES: env["MAX_IN_FLIGHT_DELIVERIES"],
  };
}

function formatConfigIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; code: string }>,
): string {
  return issues
    .map((issue) => {
      const path = issue.path.map(String).join(".") || "config";
      return `${path}: ${issue.code}`;
    })
    .join("; ");
}

function parseWebhookUrl(raw: string, nodeEnv: NodeEnv): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError("N8N_WEBHOOK_URL: invalid_url");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConfigError("N8N_WEBHOOK_URL: invalid_protocol");
  }

  if (nodeEnv === "production" && url.protocol !== "https:") {
    throw new ConfigError("N8N_WEBHOOK_URL: https_required_in_production");
  }

  return url;
}

export function loadConfig(env: EnvSource = process.env): AppConfig {
  const parsed = envSchema.safeParse(readEnv(env));
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid configuration: ${formatConfigIssues(parsed.error.issues)}`,
    );
  }

  const values = parsed.data;
  const nodeEnv = values.NODE_ENV as NodeEnv;
  const webhookUrl = parseWebhookUrl(values.N8N_WEBHOOK_URL, nodeEnv);
  const enableDirectMessages = values.DISCORD_ENABLE_DIRECT_MESSAGES;
  const guildIds = new Set(values.DISCORD_GUILD_IDS);

  if (guildIds.size === 0 && !enableDirectMessages) {
    throw new ConfigError(
      "DISCORD_GUILD_IDS: at least one guild id is required unless DISCORD_ENABLE_DIRECT_MESSAGES is true",
    );
  }

  return {
    instanceId: values.BRIDGE_INSTANCE_ID,
    discordBotToken: values.DISCORD_BOT_TOKEN,
    n8nWebhookUrl: webhookUrl.toString(),
    n8nAuthHeaderName: values.N8N_AUTH_HEADER_NAME,
    n8nAuthHeaderValue: values.N8N_AUTH_HEADER_VALUE,
    guildIds,
    channelIds: new Set(values.DISCORD_CHANNEL_IDS),
    enableDirectMessages,
    nodeEnv,
    logLevel: values.LOG_LEVEL as LogLevel,
    httpTimeoutMs: values.HTTP_TIMEOUT_MS,
    retryMaxAttempts: values.RETRY_MAX_ATTEMPTS,
    retryBaseDelayMs: values.RETRY_BASE_DELAY_MS,
    maxInFlightDeliveries: values.MAX_IN_FLIGHT_DELIVERIES,
  };
}

export function configSecrets(
  config: Pick<AppConfig, "discordBotToken" | "n8nAuthHeaderValue">,
): readonly string[] {
  return [config.discordBotToken, config.n8nAuthHeaderValue];
}
