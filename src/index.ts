import { configSecrets, loadConfig } from "./config.js";
import { ConfigError } from "./errors.js";
import { createLogger } from "./logger.js";
import { startBridge } from "./bridge.js";
import { redactUrl, toLogError } from "./redact.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const logger = createLogger(config);
  const secrets = configSecrets(config);

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
  if (error instanceof ConfigError) {
    process.stderr.write(
      `${JSON.stringify({ level: "error", msg: error.message })}\n`,
    );
    process.exit(1);
  }
  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      msg: "fatal startup error",
      err: toLogError(error),
    })}\n`,
  );
  process.exit(1);
}
