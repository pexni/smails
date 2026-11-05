# @smails/cli

[![npm](https://img.shields.io/npm/v/@smails/cli?color=000)](https://www.npmjs.com/package/@smails/cli)

**Disposable email for AI agents.** Create an inbox, use the address to sign up somewhere, and wait for the verification code — from a terminal, a script, Claude Code or Codex.

→ **[smails.dev](https://smails.dev)**

Requires Node.js 22.18 or newer. No runtime dependencies.

## Sign in (once)

```bash
npx @smails/cli login
```

It prints a link and opens your browser: sign in with GitHub and confirm the code. The session is stored in `~/.config/smails/credentials.json` and shared with the MCP server below.

## Get a verification code

```bash
npx @smails/cli create                    # → brave-otter-k3j9x2m8@smails.dev
npx @smails/cli wait --subject code       # blocks until it arrives, prints the message
npx @smails/cli wait --json | jq -r .text # in scripts
```

`wait` exits with status 2 if nothing arrives before `--timeout` (default 120 s).

## Commands

| Command | |
| --- | --- |
| `login` / `logout` / `whoami` | Account and today's quota |
| `create` | New mailbox; becomes the current one |
| `list` | Your active mailboxes |
| `inbox [address]` | Messages (default: current mailbox) |
| `read <id>` | One message (short id prefix works) |
| `wait [address]` | Wait for new mail: `--from`, `--subject`, `--timeout`, `--since` |
| `delete <id>` | Delete a message |
| `mcp` | Run the MCP server over stdio |

Add `--json` for machine-readable output. `npm i -g @smails/cli` to type `smails` instead of `npx @smails/cli`.

## MCP server

Remote (recommended) — or just tell your agent: `Set up smails for me by following https://smails.dev/setup.md`

```bash
claude mcp add --transport http --scope user smails https://smails.dev/mcp   # Claude Code, then /mcp to sign in
codex mcp add smails --url https://smails.dev/mcp && codex mcp login smails  # Codex
```

Local (stdio):

```bash
claude mcp add smails -- npx -y @smails/cli mcp   # Claude Code
codex mcp add smails -- npx -y @smails/cli mcp    # Codex
```

Sign in with `npx @smails/cli login`, or let the agent call the `login` tool, which returns a link for you to confirm. Tools: `create_mailbox`, `wait_for_message`, `list_messages`, `read_message`, `list_mailboxes`, `delete_message`, `whoami`.

## Upgrading from 0.0.x

0.1 requires signing in; the anonymous API is gone and old saved mailboxes no longer work. Run `npx @smails/cli login`, then `create`.

## Environment

`SMAILS_URL` — server to use (default `https://smails.dev`).

## License

MIT
