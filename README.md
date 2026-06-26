# smails

[![npm](https://img.shields.io/npm/v/@smails/cli?color=000&label=%40smails%2Fcli)](https://www.npmjs.com/package/@smails/cli)
[![smails.dev](https://img.shields.io/badge/try-smails.dev-000)](https://smails.dev)
[![MIT](https://img.shields.io/badge/license-MIT-000)](./LICENSE)

**Disposable email for humans and AI agents.** An instant, anonymous throwaway inbox for sign-ups, one-time codes, and confirmations — with a REST API, a CLI, and an **MCP server**, so your AI agent can receive verification emails too. No signup, no password.

→ **[smails.dev](https://smails.dev)** · `npx @smails/cli create`

> Give your agent its own inbox: plug the MCP server into Claude, Cursor, or any MCP client and it can create a mailbox and read incoming mail (verification codes, magic links) on its own.

## Features

- **Instant inbox** — open the site and you have an address, zero clicks
- **Real-time** — new mail arrives over WebSocket, no polling
- **Built for agents** — REST API, CLI, and an MCP server share the same mailbox
- **Multi-domain** — pick from configurable receiving domains
- **Self-cleaning** — mailboxes auto-expire after 7 days of inactivity
- **Serverless** — Cloudflare Workers + Durable Objects (one DO per mailbox, SQLite storage)

## Quick start

### Web

Visit **[smails.dev](https://smails.dev)** — an inbox is created for you on first load.

### CLI

```bash
npx @smails/cli create      # create a mailbox (token saved to ~/.smails)
npx @smails/cli inbox       # list messages
npx @smails/cli read <id>   # read a message (id prefix is enough)
npx @smails/cli whoami      # show the current address
npx @smails/cli create --force  # replace with a fresh mailbox
```

### MCP (for AI agents)

Add the server to any MCP client (e.g. Claude Desktop, `~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "smails": { "command": "npx", "args": ["@smails/cli", "mcp"] }
  }
}
```

Tools: `create_mailbox`, `list_messages`, `read_message`, `delete_message`, `get_address`.

### REST API

```bash
# create a mailbox
curl -X POST https://smails.dev/api/mailbox
# → { "address": "...", "token": "..." }

# list messages with the returned token
curl https://smails.dev/api/mailbox/messages \
  -H "Authorization: Bearer <token>"
```

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mailbox` | Create a mailbox → `{ address, token }` |
| `GET` | `/api/mailbox/messages` | List messages |
| `GET` | `/api/mailbox/messages/:id` | Read a message (full parsed body) |
| `DELETE` | `/api/mailbox/messages/:id` | Delete a message |
| `WS` | `/api/mailbox/connect?token=` | Stream new-mail notifications |

Authenticate every request (except create) with `Authorization: Bearer <token>`.

## How it works

```
Inbound mail ──▶ Cloudflare Email Routing (catch-all)
                          │
                          ▼
                  Worker  email() handler ──┐
                                            ▼
   Web / CLI / MCP ──REST + WS──▶  Durable Object  (one per mailbox)
                                   ├─ SQLite (messages)
                                   ├─ token auth
                                   └─ 7-day alarm → cleanup
```

- Each mailbox is a single **Durable Object**, addressed by its name; messages live in the DO's SQLite.
- The token is `{address}.{secret}`; the Worker routes by address, the DO verifies the full token.
- A 7-day alarm wipes inactive mailboxes; any activity renews it.

## Project structure

```
frontend/   React Router SPA (prerendered) — Tailwind v4 + shadcn
worker/     Cloudflare Worker + Durable Objects — Hono routing, postal-mime parsing
cli/        npm package — CLI + MCP server (@smails/cli)
```

## Development

Each package is independent (pnpm). Install per package.

```bash
# frontend
cd frontend && pnpm install && pnpm dev

# worker (API + Durable Objects)
cd worker && pnpm install && pnpm dev

# cli / mcp
cd cli && pnpm install && pnpm build
SMAILS_API_URL=http://localhost:8787 node dist/index.js create
```

## Deployment

There are two independent release tracks — pushing to `main` ships the service, but **not** the CLI.

**Worker + frontend** — auto-deployed by [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) on every push to `main` (the frontend builds to static assets the Worker serves). No manual step. To deploy by hand instead:

```bash
cd frontend && pnpm build         # → build/client
cd ../worker && pnpm run deploy   # wrangler deploy — serves assets + API + DOs
```

**CLI (`@smails/cli`) + MCP server** — *not* auto-deployed; publishing is a separate, manual release:

1. Bump the version in `cli/package.json` (npm rejects re-publishing an existing version).
2. Push to `main`.
3. `gh release create cli-vX.Y.Z --target main` — creating the GitHub Release triggers `.github/workflows/publish-cli.yml`, which publishes to npm and syncs the [MCP registry](https://registry.modelcontextprotocol.io) listing from `server.json`.

> `server.json`'s `description` must be ≤ 100 characters or the MCP registry publish step 422s.

Receiving mail uses Cloudflare Email Routing (catch-all → the Worker's `email` handler). Configure receiving domains via the `DOMAINS` var and the route in `worker/wrangler.jsonc`.

## License

MIT
