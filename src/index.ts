import { configSecrets, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { startBridge } from "./bridge.js";
import { redactUrl, toLogError } from "./redact.js";
import { formatStartupError, startupSecretsFromEnv } from "./startup-error.js";

const startupSecrets = startupSecretsFromEnv(process.env);

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const secrets = configSecrets(config);
  startupSecrets.push(...secrets);
  const logger = createLogger(config);

  logger.info(
    {
      webhook_url: redactUrl(config.n8nWebhookUrl),
      guild_allowlist_size: config.guildIds.size,
      channel_allowlist_size: config.channelIds.size,
      direct_messages: config.enableDirectMessages,
      node_env: config.nodeEnv,
    },
    "starting discord-n8n-bridge",
  );

  const bridge = await startBridge(config, logger);

  const stop = (signal: string): void => {
    logger.info({ signal }, "shutting down");
    void bridge
      .stop()
      .catch((error: unknown) => {
        logger.error({ err: toLogError(error, secrets) }, "error during shutdown");
      })
      .finally(() => {
        process.exit(0);
      });
  };

  process.once("SIGINT", () => {
    stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    stop("SIGTERM");
  });
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${formatStartupError(error, startupSecrets)}\n`);
  process.exit(1);
}
