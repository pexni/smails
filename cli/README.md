# @smails/cli

[![npm](https://img.shields.io/npm/v/@smails/cli?color=000)](https://www.npmjs.com/package/@smails/cli)

**Disposable email for humans and AI agents.** A throwaway inbox you can drive from the terminal — or plug into any AI agent as an **MCP server**, so it can receive verification codes and emails on its own. No signup.

→ **[smails.dev](https://smails.dev)**

## CLI

```bash
npx @smails/cli create        # create a mailbox (token saved to ~/.smails)
npx @smails/cli inbox         # list messages
npx @smails/cli read <id>     # read a message (full id or short prefix)
npx @smails/cli delete <id>   # delete a message
npx @smails/cli whoami        # show the current address
npx @smails/cli create --force  # replace with a fresh mailbox
```

Install globally for a shorter command:

```bash
npm i -g @smails/cli
smails create
```

## MCP server (for AI agents)

Add the server to any MCP client (e.g. Claude Desktop — `~/.claude/mcp.json`, Cursor, etc.):

```json
{
  "mcpServers": {
    "smails": {
      "command": "npx",
      "args": ["@smails/cli", "mcp"]
    }
  }
}
```

The agent can then create a mailbox and read incoming mail itself. Tools:

| Tool | Description |
|------|-------------|
| `create_mailbox` | Create a throwaway mailbox |
| `list_messages` | List messages in the current mailbox |
| `read_message` | Read a message by id |
| `delete_message` | Delete a message by id |
| `get_address` | Get the current mailbox address |

## Config

- The current mailbox (address + token) is stored in `~/.smails`.
- `SMAILS_API_URL` overrides the API base URL (default `https://smails.dev`).

## Links

- Website: [smails.dev](https://smails.dev)
- Source: [github.com/pexni/smails](https://github.com/pexni/smails)
- License: MIT
