export type NodeEnv = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type DiscordEventType =
  | "discord.message.created"
  | "discord.message.edited";

export interface AppConfig {
  instanceId: string;
  discordBotToken: string;
  n8nWebhookUrl: string;
  n8nAuthHeaderName: string;
  n8nAuthHeaderValue: string;
  guildIds: ReadonlySet<string>;
  channelIds: ReadonlySet<string>;
  enableDirectMessages: boolean;
  nodeEnv: NodeEnv;
  logLevel: LogLevel;
  httpTimeoutMs: number;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  maxInFlightDeliveries: number;
}

export interface InboundAuthor {
  id: string;
  username: string;
  globalName: string | null;
  bot: boolean;
}

export interface InboundAttachment {
  id: string;
  filename: string;
  contentType: string | null;
  size: number;
  url: string;
  proxyUrl: string;
}

export interface InboundEmbed {
  title: string | null;
  description: string | null;
  url: string | null;
  type: string | null;
}

export interface InboundReference {
  messageId: string | null;
  channelId: string | null;
  guildId: string | null;
}

export interface InboundMessage {
  id: string;
  channelId: string;
  guildId: string | null;
  parentId: string | null;
  isThread: boolean;
  author: InboundAuthor;
  webhookId: string | null;
  content: string;
  createdTimestamp: number;
  editedTimestamp: number | null;
  attachments: InboundAttachment[];
  embeds: InboundEmbed[];
  mentionEveryone: boolean;
  pinned: boolean;
  type: number;
  reference: InboundReference | null;
  partial: boolean;
}

export interface MessageEnvelope {
  spec_version: "1.0";
  event_type: DiscordEventType;
  event_id: string;
  idempotency_key: string;
  occurred_at: string;
  ingested_at: string;
  instance_id: string;
  source: {
    platform: "discord";
    guild_id: string | null;
    channel_id: string;
    parent_id: string | null;
    thread: boolean;
    message_id: string;
  };
  author: {
    id: string;
    username: string;
    global_name: string | null;
    bot: boolean;
    webhook_id: string | null;
  };
  message: {
    content: string;
    timestamp: string;
    edited_timestamp: string | null;
    attachments: Array<{
      id: string;
      filename: string;
      content_type: string | null;
      size: number;
      url: string;
      proxy_url: string;
    }>;
    embeds: Array<{
      title: string | null;
      description: string | null;
      url: string | null;
      type: string | null;
    }>;
    mention_everyone: boolean;
    pinned: boolean;
    type: number;
    reference: InboundReference | null;
  };
}

export interface Logger {
  debug(fields: Record<string, unknown>, message: string): void;
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}
