import { GatewayIntentBits, Partials } from "discord.js";
import type { AppConfig } from "./types.js";

export function buildIntents(
  config: Pick<AppConfig, "enableDirectMessages">,
): GatewayIntentBits[] {
  const intents: GatewayIntentBits[] = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ];
  if (config.enableDirectMessages) {
    intents.push(GatewayIntentBits.DirectMessages);
  }
  return intents;
}

export function buildPartials(
  config: Pick<AppConfig, "enableDirectMessages">,
): Partials[] {
  const partials: Partials[] = [Partials.Message];
  if (config.enableDirectMessages) {
    partials.push(Partials.Channel);
  }
  return partials;
}
