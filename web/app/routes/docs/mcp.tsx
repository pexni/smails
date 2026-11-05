import { Article, H2, H3, Link, List, Note, P } from "#/components/prose.tsx";
import { CodeBlock, InlineCode } from "#/ui/Code.tsx";
import { usePageHead } from "#/utils/head.ts";

const TOOLS: [string, string][] = [
	["create_mailbox", "Create a new address. Mailboxes live for 7 days."],
	[
		"wait_for_message",
		"Block (up to 50 s) until mail arrives, then return it in full. Filters: from, subject.",
	],
	[
		"list_messages",
		"List what a mailbox has received: sender, subject, time, id.",
	],
	[
		"read_message",
		"Read one message as plain text (HTML is converted; links are kept).",
	],
	["list_mailboxes", "Your mailboxes that have not expired."],
	["delete_message", "Delete one message."],
	["whoami", "The signed-in account and today's quota."],
];

export default function McpDocs() {
	usePageHead({
		title:
			"smails MCP server — disposable email for Claude, Cursor and other agents",
		description:
			"Connect the smails MCP server to Claude, Cursor, VS Code or any MCP client. Your agent creates disposable inboxes and waits for verification codes. Remote server with OAuth, or local over stdio.",
	});
	return (
		<Article
			eyebrow="Docs"
			title="MCP server"
			lead="Let your agent create inboxes and wait for verification emails. Use the remote server (sign in with GitHub when your client asks), or run it locally over stdio."
		>
			<H2>Remote server (recommended)</H2>
			<P>Add this URL as a remote (Streamable HTTP) MCP server:</P>
			<CodeBlock label="MCP server URL" code="https://smails.dev/mcp" />
			<P>
				The first time your client connects, it opens a browser window: sign in
				with GitHub and click <strong>Allow</strong>. The client keeps the
				session from then on.
			</P>
			<H3>Claude Code</H3>
			<CodeBlock
				label="terminal"
				code="claude mcp add --transport http smails https://smails.dev/mcp"
			/>
			<H3>Cursor</H3>
			<CodeBlock
				label="~/.cursor/mcp.json"
				code={`{
  "mcpServers": {
    "smails": { "url": "https://smails.dev/mcp" }
  }
}`}
			/>
			<H3>VS Code</H3>
			<CodeBlock
				label=".vscode/mcp.json"
				code={`{
  "servers": {
    "smails": { "type": "http", "url": "https://smails.dev/mcp" }
  }
}`}
			/>
			<H3>Claude (desktop and web)</H3>
			<P>Add a custom connector and paste the server URL above.</P>

			<H2>Local server (stdio)</H2>
			<P>
				For clients that only run local servers. It forwards to the same remote
				tools, so both behave identically.
			</P>
			<CodeBlock
				label="mcp.json"
				code={`{
  "mcpServers": {
    "smails": { "command": "npx", "args": ["-y", "@smails/cli", "mcp"] }
  }
}`}
			/>
			<P>
				Sign in once: run <InlineCode>npx @smails/cli login</InlineCode> in a
				terminal, or let the agent call the <InlineCode>login</InlineCode> tool
				— it returns a link for you to open and confirm.
			</P>

			<H2>Tools</H2>
			<List>
				{TOOLS.map(([name, body]) => (
					<li>
						<InlineCode>{name}</InlineCode> — {body}
					</li>
				))}
			</List>
			<Note>
				A typical run: create_mailbox → use the address on the website →
				wait_for_message with subject "code" → read the code from the returned
				text.
			</Note>

			<H2>Limits</H2>
			<List>
				<li>20 new mailboxes per account per day (UTC).</li>
				<li>
					Mailboxes expire after 7 days; after that their mail can no longer be
					read.
				</li>
				<li>
					Receive-only. Messages over 5 MB are rejected; attachments are not
					returned.
				</li>
			</List>
			<P>
				Prefer the command line? See the <Link href="/docs/cli">CLI</Link>.
				Writing your own integration? See the{" "}
				<Link href="/docs/api">HTTP API</Link>.
			</P>
		</Article>
	);
}
