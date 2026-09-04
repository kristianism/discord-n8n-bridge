import type { InboundEmbed, InboundMessage } from "./types.js";

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

function attachmentIds(message: InboundMessage): string[] {
  return sortedIds(message.attachments.map((attachment) => attachment.id));
}

function embedFingerprint(embeds: readonly InboundEmbed[]): string {
  return JSON.stringify(
    embeds.map((embed) => [
      embed.type,
      embed.title,
      embed.description,
      embed.url,
    ]),
  );
}

export function isRelevantMessageEdit(
  oldMessage: InboundMessage | null,
  newMessage: InboundMessage,
): boolean {
  if (oldMessage === null || oldMessage.partial) {
    return true;
  }
  if (oldMessage.content !== newMessage.content) {
    return true;
  }
  const oldAttachmentIds = attachmentIds(oldMessage);
  const newAttachmentIds = attachmentIds(newMessage);
  if (oldAttachmentIds.length !== newAttachmentIds.length) {
    return true;
  }
  for (const [index, id] of newAttachmentIds.entries()) {
    if (oldAttachmentIds[index] !== id) {
      return true;
    }
  }
  if (embedFingerprint(oldMessage.embeds) !== embedFingerprint(newMessage.embeds)) {
    return true;
  }
  return false;
}
