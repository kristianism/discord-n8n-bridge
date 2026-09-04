import { GatewayIntentBits, Partials } from "discord.js";
import { describe, expect, it } from "vitest";
import { buildIntents, buildPartials } from "../src/intents.js";

describe("gateway intents", () => {
  it("requests guild, guild-message, and message-content intents", () => {
    const intents = buildIntents({ enableDirectMessages: false });
    expect(intents).toEqual([
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]);
    expect(intents).not.toContain(GatewayIntentBits.GuildMembers);
    expect(intents).not.toContain(GatewayIntentBits.GuildPresences);
    expect(intents).not.toContain(GatewayIntentBits.DirectMessages);
  });

  it("adds the direct-message intent only when enabled", () => {
    const intents = buildIntents({ enableDirectMessages: true });
    expect(intents).toContain(GatewayIntentBits.DirectMessages);
    expect(buildPartials({ enableDirectMessages: true })).toContain(
      Partials.Channel,
    );
    expect(buildPartials({ enableDirectMessages: false })).toEqual([
      Partials.Message,
    ]);
  });
});
