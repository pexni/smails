import { Article, H2, Link, List, P } from "#/components/prose.tsx";
import { CodeBlock, InlineCode } from "#/ui/Code.tsx";
import { usePageHead } from "#/utils/head.ts";

export default function CliDocs() {
	usePageHead({
		title:
			"smails CLI — disposable inboxes and verification codes from the terminal",
		description:
			"Create disposable email addresses and wait for verification codes from the terminal or a script. npx @smails/cli login, create, wait.",
	});
	return (
		<Article
			docs
			title="CLI"
			lead="Create disposable inboxes and wait for verification codes from a terminal, a script, or an agent's shell. Requires Node.js 22.18 or newer."
		>
			<H2>Sign in</H2>
			<CodeBlock label="terminal" code="npx @smails/cli login" />
			<P>
				It prints a link (and opens your browser): sign in with GitHub and
				confirm the code. The session is saved in{" "}
				<InlineCode>~/.config/smails/credentials.json</InlineCode> and shared
				with the local MCP server.
			</P>

			<H2>Get a code</H2>
			<CodeBlock
				label="terminal"
				code={`smails create                       # → brave-otter-k3j9x2m8@smails.dev
smails wait --subject code --timeout 300
smails wait --json | jq -r .text     # in scripts`}
			/>
			<P>
				<InlineCode>wait</InlineCode> returns as soon as a matching message
				arrives and prints it in full. It exits with status 2 if nothing arrives
				before the timeout.
			</P>

			<H2>Commands</H2>
			<List>
				<li>
					<InlineCode>login</InlineCode>, <InlineCode>logout</InlineCode>,{" "}
					<InlineCode>whoami</InlineCode> — account and today's quota
				</li>
				<li>
					<InlineCode>create</InlineCode> — new mailbox; it becomes the current
					one
				</li>
				<li>
					<InlineCode>list</InlineCode> — your active mailboxes
				</li>
				<li>
					<InlineCode>inbox [address]</InlineCode> — messages in a mailbox
					(default: current)
				</li>
				<li>
					<InlineCode>read &lt;id&gt;</InlineCode> — one message; a short id
					prefix works
				</li>
				<li>
					<InlineCode>
						wait [address] --from x --subject y --timeout s
					</InlineCode>{" "}
					— wait for new mail
				</li>
				<li>
					<InlineCode>delete &lt;id&gt;</InlineCode> — delete a message
				</li>
				<li>
					<InlineCode>mcp</InlineCode> — run the MCP server over stdio (see{" "}
					<Link href="/docs/mcp">MCP</Link>)
				</li>
			</List>
			<P>
				Add <InlineCode>--json</InlineCode> to any command for machine-readable
				output. Install it globally with{" "}
				<InlineCode>npm i -g @smails/cli</InlineCode> to type{" "}
				<InlineCode>smails</InlineCode> instead of{" "}
				<InlineCode>npx @smails/cli</InlineCode>.
			</P>
		</Article>
	);
}
