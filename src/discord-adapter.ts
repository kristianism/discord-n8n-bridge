import type { Message, PartialMessage } from "discord.js";
import type { InboundAttachment, InboundEmbed, InboundMessage } from "./types.js";

export type DiscordJsMessage = Message | PartialMessage;

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readParentMeta(message: DiscordJsMessage): {
  parentId: string | null;
  isThread: boolean;
} {
  try {
    const channel = message.channel;
    if (channel && typeof channel.isThread === "function" && channel.isThread()) {
      const parentId =
        "parentId" in channel ? asStringOrNull(channel.parentId) : null;
      return { parentId, isThread: true };
    }
  } catch {
    return { parentId: null, isThread: false };
  }
  return { parentId: null, isThread: false };
}

function readAttachments(message: DiscordJsMessage): InboundAttachment[] {
  const attachments: InboundAttachment[] = [];
  for (const attachment of message.attachments.values()) {
    attachments.push({
      id: attachment.id,
      filename: attachment.name,
      contentType: attachment.contentType ?? null,
      size: attachment.size,
      url: attachment.url,
      proxyUrl: attachment.proxyURL,
    });
  }
  return attachments;
}

function readEmbeds(message: DiscordJsMessage): InboundEmbed[] {
  return message.embeds.map((embed) => ({
    title: embed.title ?? null,
    description: embed.description ?? null,
    url: embed.url ?? null,
    type: embed.data.type ?? null,
  }));
}

export function toInboundMessage(message: Message): InboundMessage {
  const { parentId, isThread } = readParentMeta(message);
  const reference = message.reference
    ? {
        messageId: message.reference.messageId ?? null,
        channelId: message.reference.channelId ?? null,
        guildId: message.reference.guildId ?? null,
      }
    : null;

  return {
    id: message.id,
    channelId: message.channelId,
    guildId: message.guildId ?? null,
    parentId,
    isThread,
    author: {
      id: message.author.id,
      username: message.author.username,
      globalName: message.author.globalName ?? null,
      bot: message.author.bot,
    },
    webhookId: message.webhookId ?? null,
    content: message.content,
    createdTimestamp: message.createdTimestamp,
    editedTimestamp: message.editedTimestamp,
    attachments: readAttachments(message),
    embeds: readEmbeds(message),
    mentionEveryone: message.mentions.everyone,
    pinned: message.pinned,
    type: message.type,
    reference,
    partial: false,
  };
}

export async function resolveCompleteMessage(
  message: DiscordJsMessage,
): Promise<Message> {
  if (!message.partial) {
    return message;
  }
  return message.fetch();
}
