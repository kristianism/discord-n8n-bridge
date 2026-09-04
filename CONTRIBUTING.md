# Contributing

Thanks for contributing to `discord-n8n-bridge`. This service is meant to stay organization-neutral: deployment-specific bots, guilds, and n8n instances belong in environment variables, not in source.

## Ground rules

- Keep the process a long-lived Node.js Discord Gateway client. Do not move this logic into an n8n Code node or a short-lived script.
- Do not add organization names, server names, real guild/channel IDs, or webhook URLs to source, tests, or docs.
- Do not commit secrets. See [SECURITY.md](SECURITY.md).
- Prefer small, reviewable pull requests with tests for the behavior you change.

## Development setup

Requirements: Node.js 20.11 or newer, npm.

```bash
git clone https://github.com/kristianism/discord-bridge.git
cd discord-bridge
npm ci
cp .env.example .env
```

Fill `.env` locally. Never copy those values into git, screenshots, issues, or pull requests.

```bash
npm test
npm run typecheck
npm run build
```

`npm run dev` loads `.env` via Node’s `--env-file`. `npm start` does not; production should inject environment variables.

## Configuration

Use `.env.example` as the name-only template. Real tokens, webhook paths, and ingress keys live only in `.env`, your process manager, or your container runtime.

If you add a new setting:

1. Validate it in `src/config.ts` with zod.
2. Document it in `.env.example` (names and placeholders only) and in the README table.
3. Cover invalid and default cases in `tests/config.test.ts`.

## Tests

This repository uses Vitest. Add or update tests next to the behavior you change:

| Area | Tests |
| --- | --- |
| Environment parsing | `tests/config.test.ts` |
| Guild/channel/bot filtering | `tests/filter.test.ts` |
| Envelope and idempotency keys | `tests/envelope.test.ts` |
| Edit relevance | `tests/relevance.test.ts` |
| Webhook delivery and retries | `tests/delivery.test.ts` |
| Gateway intents | `tests/intents.test.ts` |
| Log redaction | `tests/redact.test.ts`, `tests/adapter-logger.test.ts` |

Use clearly fake snowflakes and tokens in tests (for example `111111111111111111`, `discord-bot-token-value-for-tests`). Do not paste values from a live Discord application or n8n instance.

## Code style

- TypeScript with the existing strict `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- ESM only (`"type": "module"`). Use `.js` extensions on relative imports.
- Reuse native `fetch`. Do not add a second HTTP client or a second package manager.
- Do not log message content, bot tokens, auth header values, or webhook paths. Use the existing redaction helpers.
- Keep Discord Gateway intents minimal. Do not add presence or guild-member intents unless there is a proven need. Direct-message intent stays behind `DISCORD_ENABLE_DIRECT_MESSAGES`.

## Pull requests

1. Branch from `main` using `kristianism/<short-description>` if you have push access, or a descriptive fork branch otherwise.
2. Make sure `npm test` and `npm run typecheck` pass.
3. Describe the behavior change and how you tested it. Do not include `.env` contents, tokens, or production webhook URLs.
4. Open the pull request as a draft until it is ready for review.

## Security reports

If you find a vulnerability or an exposed secret, do not open a public issue. Follow [SECURITY.md](SECURITY.md).
