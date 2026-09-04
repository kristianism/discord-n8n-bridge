import { describe, expect, it } from "vitest";
import { filterReason, shouldDeliverMessage } from "../src/filter.js";
import {
  AUTHOR_ID,
  CHANNEL_ID,
  GUILD_ID,
  THREAD_ID,
  inboundMessage,
  testConfig,
} from "./helpers.js";

describe("message filtering", () => {
  it("ignores bot authors, including this bot", () => {
    const message = inboundMessage({
      author: {
        id: AUTHOR_ID,
        username: "bridge-bot",
        globalName: null,
        bot: true,
      },
    });
    expect(filterReason(message, testConfig())).toBe("bot_author");
    expect(shouldDeliverMessage(message, testConfig())).toBe(false);
  });

  it("ignores webhook authors even if the bot flag is absent", () => {
    const message = inboundMessage({ webhookId: "666666666666666666" });
    expect(filterReason(message, testConfig())).toBe("webhook_author");
  });

  it("ignores guilds outside the allowlist", () => {
    const message = inboundMessage({ guildId: "999999999999999999" });
    expect(filterReason(message, testConfig())).toBe("guild_not_allowlisted");
  });

  it("ignores channels outside the allowlist", () => {
    const message = inboundMessage({ channelId: "999999999999999999" });
    expect(filterReason(message, testConfig())).toBe("channel_not_allowlisted");
  });

  it("allows a thread when the thread channel id is allowlisted", () => {
    const message = inboundMessage({
      channelId: THREAD_ID,
      parentId: CHANNEL_ID,
      isThread: true,
    });
    const config = testConfig({ channelIds: new Set([THREAD_ID]) });
    expect(filterReason(message, config)).toBeNull();
  });

  it("allows a thread when the parent channel id is allowlisted", () => {
    const message = inboundMessage({
      channelId: THREAD_ID,
      parentId: CHANNEL_ID,
      isThread: true,
    });
    expect(filterReason(message, testConfig())).toBeNull();
  });

  it("allows every channel in an allowlisted guild when the channel list is empty", () => {
    const message = inboundMessage({ channelId: "777777777777777777" });
    const config = testConfig({ channelIds: new Set() });
    expect(filterReason(message, config)).toBeNull();
  });

  it("ignores direct messages unless they are explicitly enabled", () => {
    const dm = inboundMessage({ guildId: null, channelId: "888888888888888888" });
    expect(filterReason(dm, testConfig())).toBe("direct_message_disabled");
    expect(
      filterReason(dm, testConfig({ enableDirectMessages: true })),
    ).toBeNull();
  });

  it("does not apply the guild allowlist to enabled direct messages", () => {
    const dm = inboundMessage({
      guildId: null,
      channelId: "888888888888888888",
    });
    const config = testConfig({
      enableDirectMessages: true,
      guildIds: new Set([GUILD_ID]),
    });
    expect(shouldDeliverMessage(dm, config)).toBe(true);
  });
});
