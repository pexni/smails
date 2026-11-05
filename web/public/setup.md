# Set up smails

You are an AI agent and your user wants you to set up **smails**: disposable email inboxes for AI agents. With it you can create an email address, use it to sign up somewhere, and wait for the verification code or magic link.

Follow these steps. Run the commands yourself when you can; tell the user plainly about the one step only they can do (signing in with GitHub in a browser).

## 1. Add the MCP server

Pick the section for the client you are running in.

### Claude Code

```bash
claude mcp add --transport http --scope user smails https://smails.dev/mcp
```

Then tell the user: "Run `/mcp` in Claude Code, select **smails**, and sign in with GitHub in the browser window that opens." The smails tools appear after that (a new session may be needed).

### Codex

```bash
codex mcp add smails --url https://smails.dev/mcp
codex mcp login smails
```

`codex mcp login` opens a browser window: tell the user to sign in with GitHub and click **Allow**. If there is no browser on this machine, run `codex mcp login smails --no-browser`, give the user the printed URL, and ask them to paste the redirect URL back. Restart Codex if the tools do not appear.

### Neither (or MCP servers cannot be added here)

Use the CLI instead. It needs Node.js 22.18 or newer.

```bash
npx -y @smails/cli login
```

It prints a link. Give the link to the user and ask them to open it, sign in with GitHub and click **Confirm**; the command finishes on its own. Then use `npx -y @smails/cli create` and `npx -y @smails/cli wait --subject code` (see step 3).

## 2. Check that it works

Call the `whoami` tool (or run `npx -y @smails/cli whoami`). It should show the user's GitHub name and today's quota. If it says the user is not signed in, repeat the sign-in step above.

## 3. How to use it

- `create_mailbox` — returns a fresh address such as `brave-otter-k3j9x2m8@smails.dev`. Use it on the website.
- `wait_for_message` — blocks for up to 50 seconds until a new email arrives, then returns the whole message as plain text (links included). Pass `subject: "code"` or `from: "example.com"` to skip unrelated mail. If it returns "No new message yet", call it again.
- `list_messages`, `read_message`, `delete_message`, `list_mailboxes`, `whoami` — the rest.

Typical flow: `create_mailbox` → fill in the sign-up form → `wait_for_message` → read the code or open the link from the returned text.

CLI equivalents: `smails create`, `smails wait --subject code --timeout 300`, `smails inbox`, `smails read <id>`. Add `--json` for machine-readable output.

## Limits

- 20 new mailboxes per account per day (UTC); each mailbox lasts 7 days.
- Receive-only. Messages over 5 MB are rejected; attachments are not returned.
- Some websites block disposable email domains; smails cannot get around that.

Docs for people: https://smails.dev/docs/mcp
