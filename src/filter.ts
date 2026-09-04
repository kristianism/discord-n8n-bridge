import type { AppConfig, InboundMessage } from "./types.js";

export type FilterReason =
  | "bot_author"
  | "webhook_author"
  | "direct_message_disabled"
  | "guild_not_allowlisted"
  | "channel_not_allowlisted";

export function filterReason(
  message: InboundMessage,
  config: Pick<AppConfig, "guildIds" | "channelIds" | "enableDirectMessages">,
): FilterReason | null {
  if (message.author.bot) {
    return "bot_author";
  }
  if (message.webhookId !== null) {
    return "webhook_author";
  }
  if (message.guildId === null) {
    if (!config.enableDirectMessages) {
      return "direct_message_disabled";
    }
    return null;
  }
  if (!config.guildIds.has(message.guildId)) {
    return "guild_not_allowlisted";
  }
  if (config.channelIds.size === 0) {
    return null;
  }
  if (config.channelIds.has(message.channelId)) {
    return null;
  }
  if (message.parentId !== null && config.channelIds.has(message.parentId)) {
    return null;
  }
  return "channel_not_allowlisted";
}

export function shouldDeliverMessage(
  message: InboundMessage,
  config: Pick<AppConfig, "guildIds" | "channelIds" | "enableDirectMessages">,
): boolean {
  return filterReason(message, config) === null;
}
