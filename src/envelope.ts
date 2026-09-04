import { ENVELOPE_SPEC_VERSION } from "./version.js";
import type {
  DiscordEventType,
  InboundMessage,
  MessageEnvelope,
} from "./types.js";

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

export function buildIdempotencyKey(
  message: InboundMessage,
  eventType: DiscordEventType = "discord.message.created",
): string {
  if (eventType === "discord.message.created") {
    return `${message.id}:create`;
  }
  const edited =
    message.editedTimestamp === null
      ? "unknown"
      : toIso(message.editedTimestamp);
  return `${message.id}:${edited}`;
}

export function buildEnvelope(
  eventType: DiscordEventType,
  message: InboundMessage,
  instanceId: string,
  ingestedAt: Date,
): MessageEnvelope {
  const createdAt = toIso(message.createdTimestamp);
  const editedAt =
    message.editedTimestamp === null ? null : toIso(message.editedTimestamp);
  const occurredAt = eventType === "discord.message.edited"
    ? (editedAt ?? createdAt)
    : createdAt;
  const idempotencyKey = buildIdempotencyKey(message, eventType);

  return {
    spec_version: ENVELOPE_SPEC_VERSION,
    event_type: eventType,
    event_id: idempotencyKey,
    idempotency_key: idempotencyKey,
    occurred_at: occurredAt,
    ingested_at: ingestedAt.toISOString(),
    instance_id: instanceId,
    source: {
      platform: "discord",
      guild_id: message.guildId,
      channel_id: message.channelId,
      parent_id: message.parentId,
      thread: message.isThread,
      message_id: message.id,
    },
    author: {
      id: message.author.id,
      username: message.author.username,
      global_name: message.author.globalName,
      bot: message.author.bot,
      webhook_id: message.webhookId,
    },
    message: {
      content: message.content,
      timestamp: createdAt,
      edited_timestamp: editedAt,
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        content_type: attachment.contentType,
        size: attachment.size,
        url: attachment.url,
        proxy_url: attachment.proxyUrl,
      })),
      embeds: message.embeds.map((embed) => ({
        title: embed.title,
        description: embed.description,
        url: embed.url,
        type: embed.type,
      })),
      mention_everyone: message.mentionEveryone,
      pinned: message.pinned,
      type: message.type,
      reference: message.reference,
    },
  };
}
