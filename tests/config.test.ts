import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { ConfigError } from "../src/errors.js";
import { GUILD_ID, validEnv } from "./helpers.js";

describe("loadConfig", () => {
  it("parses a complete environment into typed config", () => {
    const config = loadConfig(validEnv());
    expect(config.instanceId).toBe("test-instance");
    expect(config.guildIds.has(GUILD_ID)).toBe(true);
    expect(config.channelIds.size).toBe(1);
    expect(config.enableDirectMessages).toBe(false);
    expect(config.n8nAuthHeaderName).toBe("X-Discord-Ingress-Key");
    expect(config.retryMaxAttempts).toBe(3);
  });

  it("treats an empty channel allowlist as all channels in allowlisted guilds", () => {
    const config = loadConfig(validEnv({ DISCORD_CHANNEL_IDS: "" }));
    expect(config.channelIds.size).toBe(0);
  });

  it("parses comma-separated guild and channel ids", () => {
    const config = loadConfig(
      validEnv({
        DISCORD_GUILD_IDS: "111111111111111111, 222222222222222222",
        DISCORD_CHANNEL_IDS: "333333333333333333,444444444444444444",
      }),
    );
    expect(config.guildIds.size).toBe(2);
    expect(config.channelIds.has("333333333333333333")).toBe(true);
  });

  it("defaults optional numeric and bool fields", () => {
    const config = loadConfig(
      validEnv({
        DISCORD_ENABLE_DIRECT_MESSAGES: undefined,
        HTTP_TIMEOUT_MS: undefined,
        RETRY_MAX_ATTEMPTS: undefined,
        RETRY_BASE_DELAY_MS: undefined,
        MAX_IN_FLIGHT_DELIVERIES: undefined,
        LOG_LEVEL: undefined,
        NODE_ENV: undefined,
        N8N_AUTH_HEADER_NAME: undefined,
      }),
    );
    expect(config.enableDirectMessages).toBe(false);
    expect(config.httpTimeoutMs).toBe(10_000);
    expect(config.retryMaxAttempts).toBe(5);
    expect(config.retryBaseDelayMs).toBe(1_000);
    expect(config.maxInFlightDeliveries).toBe(32);
    expect(config.logLevel).toBe("info");
    expect(config.nodeEnv).toBe("production");
    expect(config.n8nAuthHeaderName).toBe("X-Discord-Ingress-Key");
  });

  it("enables direct messages from a string bool", () => {
    const config = loadConfig(
      validEnv({ DISCORD_ENABLE_DIRECT_MESSAGES: "true" }),
    );
    expect(config.enableDirectMessages).toBe(true);
  });

  it("allows empty guild allowlist when direct messages are enabled", () => {
    const config = loadConfig(
      validEnv({
        DISCORD_GUILD_IDS: "",
        DISCORD_ENABLE_DIRECT_MESSAGES: "true",
      }),
    );
    expect(config.guildIds.size).toBe(0);
    expect(config.enableDirectMessages).toBe(true);
  });

  it("rejects a missing bot token without echoing secret-like values", () => {
    const token = "super-secret-bot-token-value";
    try {
      loadConfig(
        validEnv({
          DISCORD_BOT_TOKEN: undefined,
          N8N_AUTH_HEADER_VALUE: token,
        }),
      );
      throw new Error("expected ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = error instanceof Error ? error.message : "";
      expect(message).toContain("DISCORD_BOT_TOKEN");
      expect(message).not.toContain(token);
    }
  });

  it("rejects missing guild ids when direct messages are disabled", () => {
    expect(() => loadConfig(validEnv({ DISCORD_GUILD_IDS: "" }))).toThrow(
      ConfigError,
    );
  });

  it("rejects http webhook URLs in production", () => {
    expect(() =>
      loadConfig(
        validEnv({
          NODE_ENV: "production",
          N8N_WEBHOOK_URL: "http://n8n.example.com/webhook/ingress",
        }),
      ),
    ).toThrow(/https_required_in_production/);
  });

  it("allows http webhook URLs outside production", () => {
    const config = loadConfig(
      validEnv({
        NODE_ENV: "development",
        N8N_WEBHOOK_URL: "http://127.0.0.1:5678/webhook/ingress",
      }),
    );
    expect(config.n8nWebhookUrl).toContain("http://127.0.0.1:5678");
  });

  it("rejects invalid snowflake ids", () => {
    expect(() =>
      loadConfig(validEnv({ DISCORD_GUILD_IDS: "not-a-snowflake" })),
    ).toThrow(ConfigError);
  });

  it("rejects header names that could inject headers", () => {
    expect(() =>
      loadConfig(validEnv({ N8N_AUTH_HEADER_NAME: "X-Key\nX-Injected" })),
    ).toThrow(ConfigError);
  });
});
