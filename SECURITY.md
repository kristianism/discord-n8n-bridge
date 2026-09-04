# Security

This project is a Discord Gateway bridge. A leaked bot token or n8n webhook path lets anyone receive or impersonate traffic for that deployment.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for:

- Exposed Discord bot tokens, n8n webhook URLs, or ingress header values
- Unredacted message content in logs
- Authentication bypass around webhook delivery

Email the maintainer through GitHub (use a private vulnerability report on this repository if it is enabled) and include:

- A description of the issue
- Affected versions or commit SHAs
- Steps to reproduce **without** pasting live secrets

Rotate any exposed token or webhook immediately. Do not wait for a reply.

## What must never appear in git

| Item | Where it belongs |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Local `.env` or the host environment |
| `N8N_AUTH_HEADER_VALUE` | Local `.env` or the host environment |
| Real `N8N_WEBHOOK_URL` paths | Local `.env` or the host environment (the path is a credential) |
| Populated `.env`, `credentials.json`, `*.pem`, `*.key` | Never committed |

`.env.example` may contain **names and placeholders only**.

## Going public

Before changing this repository from private to public:

1. Confirm `.env` is gitignored and has never been committed (`git log --all -- .env`).
2. Confirm GitHub secret scanning and push protection are enabled (they are available for public repositories).
3. Rotate the Discord bot token and n8n webhook if they were ever pasted into chat, CI logs, or a private issue.
4. Treat guild and channel IDs as operational identifiers. They are not tokens, but they should not be hard-coded for a live server.

If a secret does land in git history, rotating it is required. Removing the file from a later commit is not enough.
