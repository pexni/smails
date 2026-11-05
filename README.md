# smails

[![npm](https://img.shields.io/npm/v/@smails/cli?color=000&label=%40smails%2Fcli)](https://www.npmjs.com/package/@smails/cli)
[![smails.dev](https://img.shields.io/badge/docs-smails.dev-000)](https://smails.dev)
[![MIT](https://img.shields.io/badge/license-MIT-000)](./LICENSE)

**Disposable email for AI agents.** Your agent creates an inbox, signs up somewhere, and waits for the verification code or magic link — over a remote MCP server, a local MCP server, a CLI, or plain HTTP.

Looking for a throwaway inbox for yourself, in the browser? Use **[smail.pw](https://smail.pw)**.

## Use it

**Fastest** — paste this into Claude Code or Codex. The agent reads [setup.md](https://smails.dev/setup.md), adds the server, and tells you when to sign in with GitHub:

```
Set up smails for me by following https://smails.dev/setup.md
```

**Claude Code** — then run `/mcp` to sign in:

```bash
claude mcp add --transport http --scope user smails https://smails.dev/mcp
```

**Codex**

```bash
codex mcp add smails --url https://smails.dev/mcp
codex mcp login smails
```

**CLI**

```bash
npx @smails/cli login                 # once: confirm in the browser
npx @smails/cli create                # → brave-otter-k3j9x2m8@smails.dev
npx @smails/cli wait --subject code   # blocks until the email arrives, prints it
```

Docs: [MCP](https://smails.dev/docs/mcp) · [CLI](https://smails.dev/docs/cli) · [HTTP API](https://smails.dev/docs/api)

Free: 20 new mailboxes per account per day; each lives for 7 days. Receive-only.

## How it works

```
                 ┌──────────────────────── Worker (smails.dev) ───────────────────────┐
CLI / local MCP ─┤ /api/*   mail API (Bearer token, verified by signature, no lookup)  │
remote MCP ──────┤ /mcp     MCP Streamable HTTP, stateless                             │
browser ─────────┤ OAuth 2.1 server + device login, GitHub as the identity provider    │
Email Routing ───┤ email()  raw → R2, metadata → D1, then notify InboxHub              │
                 └───────────┬───────────────┬──────────────┬──────────────┬──────────┘
                         D1 core         D1 mail         R2 raw mail   InboxHub (one DO,
                         users, tokens,  message         (never        hibernating
                         mailboxes,      metadata        deleted)      WebSockets)
                         quota
```

- **Sign-in is required.** Remote MCP clients use OAuth 2.1 with PKCE (Client ID Metadata Documents or dynamic registration); the CLI and local MCP use device authorization (RFC 8628). Both get the same tokens.
- **Cheap per mailbox.** Creating a mailbox is one row; access tokens are verified by signature, so API calls never read KV or D1 to authenticate. Mail metadata (~250 bytes) goes to D1, the raw message to R2, and nothing is deleted.
- **Waiting is push, not polling.** `wait` connects to a single hibernating Durable Object before checking D1, so it returns the moment mail arrives and costs one request however long it waits.
- **Addresses carry a checksum**, so mail to addresses we never issued is dropped without a write.

The full design and the reasoning behind it: [docs/rewrite-design.md](docs/rewrite-design.md).

## Repository

```
site.config.ts   names and ids (domain, Worker, D1, R2) — the only place they are written
web/             site: Solid 2 + StyleX, prerendered to static files
worker/          Cloudflare Worker: API, MCP, OAuth, email handler (cloudflare.config.ts + cf CLI)
cli/             @smails/cli: CLI and stdio MCP server (no runtime dependencies)
docs/            design and launch notes
```

## Development

Node.js 22.18+ and pnpm.

```bash
pnpm install
cp worker/.env.example worker/.env   # local signing secrets; GitHub keys optional
pnpm --filter smails-web run build   # the worker serves web/dist/client
pnpm --filter smails-worker run dev  # http://localhost:8792 (D1/R2/DO simulated locally)
```

- Without a GitHub OAuth App, sign in locally at `http://localhost:8792/__dev/login?login=you&next=/account`. That route exists only in dev builds.
- Simulate inbound mail: `curl -X POST "http://localhost:8792/cdn-cgi/local/email?from=a@example.com&to=<address>" --data-binary @message.eml`
- Point the CLI at it: `SMAILS_URL=http://localhost:8792 node cli/dist/index.js login`

```bash
pnpm run check        # types + oxlint + oxfmt
pnpm -r run test      # unit tests + end-to-end tests against a real workerd dev server
```

## Deployment

Two independent tracks.

**Worker + site** — deployed by hand with the `cf` CLI (see [docs/launch.md](docs/launch.md) for the first launch):

```bash
cd worker
pnpm run deploy            # build web + worker, apply D1 migrations, cf deploy
```

**CLI (`@smails/cli`) + MCP registry listing** — bump `cli/package.json`, push, then `gh release create cli-vX.Y.Z --target main`. The release triggers `.github/workflows/publish-cli.yml` (npm with provenance, then the MCP registry from `server.json`; its `description` must stay ≤ 100 characters).

Operations: `pnpm --filter smails-worker run users | stats | ban <login> | unban <login>`.

## License

MIT
