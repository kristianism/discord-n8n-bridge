# discord-n8n-bridge

Persistent Node.js service that holds a Discord Gateway connection, normalizes new and edited messages into a stable JSON envelope, and POSTs that envelope to an n8n webhook.

n8n is the workflow and routing layer. This process owns only the long-lived Gateway connection and bounded delivery to the configured ingress URL. Deploy it once per Discord bot / n8n instance; all deployment-specific values come from environment variables.

## Requirements

- Node.js 20.11 or newer
- A Discord application bot token
- The **Message Content Intent** enabled for that bot in the [Discord Developer Portal](https://discord.com/developers/applications) (Privileged Gateway Intents)
- An n8n webhook URL that accepts `POST` JSON

This service requests `Guilds`, `GuildMessages`, and `MessageContent` intents. It does not request presence or guild-member intents. Direct-message intent is added only when `DISCORD_ENABLE_DIRECT_MESSAGES=true`.

## Configuration

Copy `.env.example` and set values for the deployment. Never commit a populated `.env` file.

| Variable | Required | Description |
| --- | --- | --- |
| `BRIDGE_INSTANCE_ID` | yes | Unique name for this running instance |
| `DISCORD_BOT_TOKEN` | yes | Discord bot token |
| `N8N_WEBHOOK_URL` | yes | n8n webhook URL. Must be `https` when `NODE_ENV=production` |
| `N8N_AUTH_HEADER_NAME` | no | Auth header name. Default: `X-Discord-Ingress-Key` |
| `N8N_AUTH_HEADER_VALUE` | yes | Shared secret sent on every webhook POST |
| `DISCORD_GUILD_IDS` | yes* | Comma-separated guild IDs. Required unless direct messages are enabled |
| `DISCORD_CHANNEL_IDS` | no | Comma-separated channel IDs. Empty means all channels in allowlisted guilds |
| `DISCORD_ENABLE_DIRECT_MESSAGES` | no | `true` / `false`. Default: `false` |
| `NODE_ENV` | no | `development`, `test`, or `production`. Default: `production` |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, or `error`. Default: `info` |
| `HTTP_TIMEOUT_MS` | no | Webhook timeout in milliseconds. Default: `10000` |
| `RETRY_MAX_ATTEMPTS` | no | Max delivery attempts. Default: `5` |
| `RETRY_BASE_DELAY_MS` | no | Exponential backoff base delay. Default: `1000` |
| `MAX_IN_FLIGHT_DELIVERIES` | no | Max concurrent webhook POSTs. Default: `32` |

\* At least one guild ID is required unless `DISCORD_ENABLE_DIRECT_MESSAGES=true`.

### Filtering

- Messages authored by bots (including this bot) are ignored, as are webhook-authored messages, to prevent outbound-message loops.
- Guild messages are ignored unless the guild ID is allowlisted.
- When `DISCORD_CHANNEL_IDS` is set, the message is delivered only if the channel ID or the thread parent ID is allowlisted. The thread's own channel ID is the routable `channel_id`; `parent_id` is preserved when available.
- Direct messages are ignored unless `DISCORD_ENABLE_DIRECT_MESSAGES=true`. Enabled DMs are not filtered by the guild allowlist.

### Edits

- `messageCreate` is emitted as `discord.message.created`.
- `messageUpdate` is emitted as `discord.message.edited`. Edits are never collapsed into the create event.
- If the edited message is partial, the service fetches the current message. If the fetch fails, it logs a redacted error and does not fabricate content.
- Updates are skipped when the previous message is fully available and neither content, attachments, nor embeds changed. If the old message is partial or missing, the update is treated as relevant and delivered.
- Empty content is preserved, including attachment-only or embed-only edits.

## Envelope

Each webhook body is JSON:

```json
{
  "spec_version": "1.0",
  "event_type": "discord.message.created",
  "event_id": "444444444444444444:create",
  "idempotency_key": "444444444444444444:create",
  "occurred_at": "2026-01-02T03:04:05.000Z",
  "ingested_at": "2026-01-02T03:05:00.000Z",
  "instance_id": "instance-name",
  "source": {
    "platform": "discord",
    "guild_id": "111111111111111111",
    "channel_id": "222222222222222222",
    "parent_id": null,
    "thread": false,
    "message_id": "444444444444444444"
  },
  "author": {
    "id": "555555555555555555",
    "username": "member",
    "global_name": "Member",
    "bot": false,
    "webhook_id": null
  },
  "message": {
    "content": "hello",
    "timestamp": "2026-01-02T03:04:05.000Z",
    "edited_timestamp": null,
    "attachments": [],
    "embeds": [],
    "mention_everyone": false,
    "pinned": false,
    "type": 0,
    "reference": null
  }
}
```

The idempotency key is `{message_id}:create` for creates and `{message_id}:{edited_timestamp}` for edits. If an edit has no edited timestamp, the suffix is `unknown` so it cannot collide with the create event. The same value is sent as the `Idempotency-Key` HTTP header.

## Delivery

- `POST` JSON to `N8N_WEBHOOK_URL` with the configured auth header.
- Time out after `HTTP_TIMEOUT_MS`.
- Retry network failures, timeouts, `408`, `429`, and `5xx` with exponential backoff (`RETRY_BASE_DELAY_MS`) plus jitter. Honor `Retry-After` when present, capped at 60 seconds. Do not retry other `4xx` responses.
- Bound concurrent POSTs with `MAX_IN_FLIGHT_DELIVERIES`. Additional events are shed with a warning if the wait queue would grow past twice that limit.
- Failures are logged; the Gateway connection stays up.

Validate the secret in n8n (for example with a Header Auth check or an IF node) before routing.

## Run

```bash
cp .env.example .env
npm ci
npm test
npm run build
npm start
```

Local development with a `.env` file:

```bash
npm run dev
```

Production environments should inject variables directly. `npm start` does not read `.env`.

### Docker

```bash
docker build -t discord-n8n-bridge .
docker run --rm --env-file .env discord-n8n-bridge
```

Run one container (or process) per organization / Discord bot / n8n webhook. Change only the environment; do not fork the source.

## Logging and secrets

Logs are JSON on stdout. They include instance id, event type, Discord snowflake ids, HTTP status, and attempt count. They do not include bot tokens, auth header values, message content, or webhook paths.

On `SIGINT` / `SIGTERM` the process destroys the Discord client and drains in-flight deliveries before exit.
