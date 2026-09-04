import { describe, expect, it } from "vitest";
import type { Message } from "discord.js";
import { resolveCompleteMessage } from "../src/discord-adapter.js";
import { createLogger } from "../src/logger.js";
import { testConfig } from "./helpers.js";

describe("partial messages and logs", () => {
  it("does not fabricate content when a partial message cannot be fetched", async () => {
    const partial = {
      partial: true,
      id: "444444444444444444",
      channelId: "222222222222222222",
      fetch: async () => {
        throw new Error("Unknown Message");
      },
    } as unknown as Message;

    await expect(resolveCompleteMessage(partial)).rejects.toThrow(
      "Unknown Message",
    );
  });

  it("does not write secrets into log lines", () => {
    const lines: string[] = [];
    const config = testConfig();
    const logger = createLogger(config, (line) => {
      lines.push(line);
    });
    logger.error(
      {
        webhook_url: config.n8nWebhookUrl,
        detail: `token=${config.discordBotToken} auth=${config.n8nAuthHeaderValue}`,
      },
      "failed",
    );
    const joined = lines.join("\n");
    expect(joined).not.toContain(config.discordBotToken);
    expect(joined).not.toContain(config.n8nAuthHeaderValue);
    expect(joined).not.toContain("/webhook/ingress");
    expect(joined).toContain("https://n8n.example.com");
  });
});
