import { Article, H2, Link, List, Note, P } from "#/components/prose.tsx";
import { SETUP_PROMPT } from "#/setup.ts";
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
		title: "smails MCP server — disposable email for Claude Code and Codex",
		description:
			"Connect the smails MCP server to Claude Code or Codex. Your agent creates disposable inboxes and waits for verification codes. Remote server with OAuth, or local over stdio.",
	});
	return (
		<Article
			docs
			title="MCP server"
			lead="Let your agent create inboxes and wait for verification emails. Add the remote server to Claude Code or Codex and sign in with GitHub once."
		>
			<H2>Fastest: ask your agent</H2>
			<P>
				Paste this into Claude Code or Codex. The agent reads the setup
				instructions, adds the server and tells you when to sign in.
			</P>
			<CodeBlock label="prompt" code={SETUP_PROMPT} />

			<H2>Claude Code</H2>
			<CodeBlock
				label="terminal"
				code="claude mcp add --transport http smails https://smails.dev/mcp"
			/>
			<P>
				Then run <InlineCode>/mcp</InlineCode> inside Claude Code, pick{" "}
				<strong>smails</strong> and sign in with GitHub in the browser window
				that opens. Add <InlineCode>--scope user</InlineCode> to make it
				available in every project.
			</P>

			<H2>Codex</H2>
			<CodeBlock
				label="terminal"
				code={`codex mcp add smails --url https://smails.dev/mcp
codex mcp login smails`}
			/>
			<P>
				<InlineCode>codex mcp login</InlineCode> opens a browser window to sign
				in with GitHub. On a machine without a browser, add{" "}
				<InlineCode>--no-browser</InlineCode> and paste the redirect URL back
				into the terminal.
			</P>

			<H2>Local server (stdio)</H2>
			<P>
				If you prefer a local process, the CLI runs the same tools over stdio
				(it forwards to the remote server).
			</P>
			<CodeBlock
				label="terminal"
				code={`claude mcp add smails -- npx -y @smails/cli mcp      # Claude Code
codex mcp add smails -- npx -y @smails/cli mcp       # Codex`}
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
