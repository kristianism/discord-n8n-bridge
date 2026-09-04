import {
  Client,
  Events,
  type Message,
  type PartialMessage,
} from "discord.js";
import { configSecrets } from "./config.js";
import {
  resolveCompleteMessage,
  toInboundMessage,
} from "./discord-adapter.js";
import { DeliveryService } from "./delivery.js";
import { DeliveryShedError } from "./errors.js";
import { buildEnvelope } from "./envelope.js";
import { filterReason } from "./filter.js";
import { buildIntents, buildPartials } from "./intents.js";
import { toLogError } from "./redact.js";
import { isRelevantMessageEdit } from "./relevance.js";
import type { AppConfig, DiscordEventType, Logger } from "./types.js";

export interface Bridge {
  stop(): Promise<void>;
}

export interface BridgeDependencies {
  client?: Client;
  delivery?: DeliveryService;
  now?: () => Date;
}

export async function startBridge(
  config: AppConfig,
  logger: Logger,
  deps: BridgeDependencies = {},
): Promise<Bridge> {
  const secrets = configSecrets(config);
  const client =
    deps.client ??
    new Client({
      intents: buildIntents(config),
      partials: buildPartials(config),
    });
  const delivery = deps.delivery ?? new DeliveryService(config, logger);
  const now = deps.now ?? (() => new Date());

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(
      { discord_user_id: readyClient.user.id },
      "discord gateway ready",
    );
  });

  client.on(Events.Error, (error) => {
    logger.error({ err: toLogError(error, secrets) }, "discord client error");
  });

  client.on(Events.Warn, (warning) => {
    logger.warn({ warning: warning.slice(0, 500) }, "discord client warning");
  });

  client.on(Events.MessageCreate, (message) => {
    void handleMessageEvent({
      eventType: "discord.message.created",
      message,
      oldMessage: null,
      config,
      logger,
      delivery,
      now,
      secrets,
    });
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    void handleMessageEvent({
      eventType: "discord.message.edited",
      message: newMessage,
      oldMessage,
      config,
      logger,
      delivery,
      now,
      secrets,
    });
  });

  await client.login(config.discordBotToken);

  return {
    async stop() {
      client.destroy();
      await delivery.drain();
    },
  };
}

interface HandleArgs {
  eventType: DiscordEventType;
  message: Message | PartialMessage;
  oldMessage: Message | PartialMessage | null;
  config: AppConfig;
  logger: Logger;
  delivery: DeliveryService;
  now: () => Date;
  secrets: readonly string[];
}

async function handleMessageEvent(args: HandleArgs): Promise<void> {
  const { eventType, config, logger, delivery, now, secrets } = args;

  try {
    let resolved: Message;
    try {
      resolved = await resolveCompleteMessage(args.message);
    } catch (error) {
      logger.error(
        {
          event_type: eventType,
          message_id: args.message.id,
          channel_id: args.message.channelId,
          err: toLogError(error, secrets),
        },
        "failed to fetch partial message",
      );
      return;
    }

    const inbound = toInboundMessage(resolved);
    const reason = filterReason(inbound, config);
    if (reason !== null) {
      logger.debug(
        {
          event_type: eventType,
          message_id: inbound.id,
          channel_id: inbound.channelId,
          guild_id: inbound.guildId,
          reason,
        },
        "ignored discord message",
      );
      return;
    }

    if (eventType === "discord.message.edited") {
      const oldInbound =
        args.oldMessage === null || args.oldMessage.partial
          ? null
          : toInboundMessage(args.oldMessage);
      if (!isRelevantMessageEdit(oldInbound, inbound)) {
        logger.debug(
          {
            event_type: eventType,
            message_id: inbound.id,
            channel_id: inbound.channelId,
          },
          "ignored irrelevant message update",
        );
        return;
      }
    }

    const envelope = buildEnvelope(eventType, inbound, config.instanceId, now());
    try {
      await delivery.deliver(envelope);
    } catch (error) {
      if (error instanceof DeliveryShedError) {
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error(
      {
        event_type: eventType,
        message_id: args.message.id,
        err: toLogError(error, secrets),
      },
      "failed to process discord event",
    );
  }
}
