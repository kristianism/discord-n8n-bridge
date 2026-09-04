import type { AppConfig, InboundMessage, Logger } from "../src/types.js";

export const GUILD_ID = "111111111111111111";
export const CHANNEL_ID = "222222222222222222";
export const THREAD_ID = "333333333333333333";
export const MESSAGE_ID = "444444444444444444";
export const AUTHOR_ID = "555555555555555555";

export function validEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    BRIDGE_INSTANCE_ID: "test-instance",
    DISCORD_BOT_TOKEN: "discord-bot-token-value-for-tests",
    N8N_WEBHOOK_URL: "https://n8n.example.com/webhook/ingress",
    N8N_AUTH_HEADER_NAME: "X-Discord-Ingress-Key",
    N8N_AUTH_HEADER_VALUE: "ingress-secret-value",
    DISCORD_GUILD_IDS: GUILD_ID,
    DISCORD_CHANNEL_IDS: CHANNEL_ID,
    DISCORD_ENABLE_DIRECT_MESSAGES: "false",
    NODE_ENV: "test",
    LOG_LEVEL: "info",
    HTTP_TIMEOUT_MS: "1000",
    RETRY_MAX_ATTEMPTS: "3",
    RETRY_BASE_DELAY_MS: "10",
    MAX_IN_FLIGHT_DELIVERIES: "2",
    ...overrides,
  };
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    instanceId: "test-instance",
    discordBotToken: "discord-bot-token-value-for-tests",
    n8nWebhookUrl: "https://n8n.example.com/webhook/ingress",
    n8nAuthHeaderName: "X-Discord-Ingress-Key",
    n8nAuthHeaderValue: "ingress-secret-value",
    guildIds: new Set([GUILD_ID]),
    channelIds: new Set([CHANNEL_ID]),
    enableDirectMessages: false,
    nodeEnv: "test",
    logLevel: "info",
    httpTimeoutMs: 1000,
    retryMaxAttempts: 3,
    retryBaseDelayMs: 10,
    maxInFlightDeliveries: 2,
    ...overrides,
  };
}

export function inboundMessage(
  overrides: Partial<InboundMessage> = {},
): InboundMessage {
  return {
    id: MESSAGE_ID,
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    parentId: null,
    isThread: false,
    author: {
      id: AUTHOR_ID,
      username: "member",
      globalName: "Member",
      bot: false,
    },
    webhookId: null,
    content: "hello",
    createdTimestamp: Date.parse("2026-01-02T03:04:05.000Z"),
    editedTimestamp: null,
    attachments: [],
    embeds: [],
    mentionEveryone: false,
    pinned: false,
    type: 0,
    reference: null,
    partial: false,
    ...overrides,
  };
}

export function silentLogger(): Logger {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}
