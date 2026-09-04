import { configSecrets } from "./config.js";
import { DeliveryShedError } from "./errors.js";
import { redactUrl, toLogError } from "./redact.js";
import type { AppConfig, Logger, MessageEnvelope } from "./types.js";
import { SERVICE_NAME, SERVICE_VERSION } from "./version.js";

export interface DeliveryDependencies {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

const DEFAULT_DEPS: DeliveryDependencies = {
  fetch: globalThis.fetch.bind(globalThis),
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  random: Math.random,
};

const MAX_RETRY_AFTER_MS = 60_000;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMs(response: Response, fallbackMs: number): number {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return fallbackMs;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }
  return fallbackMs;
}

function backoffMs(
  attempt: number,
  baseDelayMs: number,
  random: () => number,
): number {
  const exp = baseDelayMs * 2 ** (attempt - 1);
  const jitter = random() * 0.2 * exp;
  return Math.min(exp + jitter, MAX_RETRY_AFTER_MS);
}

function isRetryableFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    error.name === "TypeError"
  );
}

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  get pending(): number {
    return this.waiters.length;
  }

  get inFlight(): number {
    return this.active;
  }

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next !== undefined) {
      next();
      return;
    }
    this.active -= 1;
  }
}

export class DeliveryService {
  private readonly deps: DeliveryDependencies;
  private readonly semaphore: Semaphore;
  private draining = false;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    deps: Partial<DeliveryDependencies> = {},
  ) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
    this.semaphore = new Semaphore(config.maxInFlightDeliveries);
  }

  async deliver(envelope: MessageEnvelope): Promise<void> {
    if (
      this.draining ||
      this.semaphore.inFlight + this.semaphore.pending >=
        this.config.maxInFlightDeliveries * 2
    ) {
      this.logger.warn(
        {
          event_type: envelope.event_type,
          message_id: envelope.source.message_id,
          idempotency_key: envelope.idempotency_key,
        },
        "delivery shed: in-flight capacity exhausted",
      );
      throw new DeliveryShedError();
    }

    await this.semaphore.acquire();
    try {
      await this.postWithRetry(envelope);
    } finally {
      this.semaphore.release();
    }
  }

  async drain(timeoutMs = 15_000): Promise<void> {
    this.draining = true;
    const started = Date.now();
    while (this.semaphore.inFlight > 0) {
      if (Date.now() - started >= timeoutMs) {
        this.logger.warn(
          { in_flight: this.semaphore.inFlight },
          "delivery drain timed out",
        );
        return;
      }
      await this.deps.sleep(50);
    }
  }

  private async postWithRetry(envelope: MessageEnvelope): Promise<void> {
    const secrets = configSecrets(this.config);
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.retryMaxAttempts; attempt += 1) {
      try {
        const response = await this.deps.fetch(this.config.n8nWebhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": `${SERVICE_NAME}/${SERVICE_VERSION}`,
            "idempotency-key": envelope.idempotency_key,
            [this.config.n8nAuthHeaderName]: this.config.n8nAuthHeaderValue,
          },
          body: JSON.stringify(envelope),
          signal: AbortSignal.timeout(this.config.httpTimeoutMs),
        });

        if (response.ok) {
          this.logger.info(
            {
              event_type: envelope.event_type,
              message_id: envelope.source.message_id,
              channel_id: envelope.source.channel_id,
              guild_id: envelope.source.guild_id,
              idempotency_key: envelope.idempotency_key,
              status: response.status,
              attempt,
              webhook_url: this.config.n8nWebhookUrl,
            },
            "delivered discord event",
          );
          await response.body?.cancel().catch(() => undefined);
          return;
        }

        const retryable = isRetryableStatus(response.status);
        await response.body?.cancel().catch(() => undefined);

        if (!retryable || attempt === this.config.retryMaxAttempts) {
          this.logger.error(
            {
              event_type: envelope.event_type,
              message_id: envelope.source.message_id,
              status: response.status,
              attempt,
              webhook_url: redactUrl(this.config.n8nWebhookUrl),
            },
            "n8n webhook rejected delivery",
          );
          return;
        }

        const delay = retryAfterMs(
          response,
          backoffMs(attempt, this.config.retryBaseDelayMs, this.deps.random),
        );
        this.logger.warn(
          {
            event_type: envelope.event_type,
            message_id: envelope.source.message_id,
            status: response.status,
            attempt,
            delay_ms: delay,
          },
          "retrying n8n webhook delivery",
        );
        await this.deps.sleep(delay);
      } catch (error) {
        lastError = error;
        if (!isRetryableFailure(error) || attempt === this.config.retryMaxAttempts) {
          this.logger.error(
            {
              event_type: envelope.event_type,
              message_id: envelope.source.message_id,
              attempt,
              err: toLogError(error, secrets),
              webhook_url: redactUrl(this.config.n8nWebhookUrl),
            },
            "n8n webhook delivery failed",
          );
          return;
        }
        const delay = backoffMs(
          attempt,
          this.config.retryBaseDelayMs,
          this.deps.random,
        );
        this.logger.warn(
          {
            event_type: envelope.event_type,
            message_id: envelope.source.message_id,
            attempt,
            delay_ms: delay,
            err: toLogError(error, secrets),
          },
          "retrying n8n webhook delivery",
        );
        await this.deps.sleep(delay);
      }
    }

    if (lastError !== undefined) {
      this.logger.error(
        {
          event_type: envelope.event_type,
          message_id: envelope.source.message_id,
          err: toLogError(lastError, secrets),
        },
        "n8n webhook delivery exhausted retries",
      );
    }
  }
}
