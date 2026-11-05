import * as stylex from "@stylexjs/stylex";

import { Article, H2, Link, P } from "#/components/prose.tsx";
import { CodeBlock, InlineCode } from "#/ui/Code.tsx";
import { color, font, space, text } from "#/ui/tokens.stylex.ts";
import { usePageHead } from "#/utils/head.ts";

const ENDPOINTS: [string, string, string][] = [
	["GET", "/api/me", "Account, plan and today's quota"],
	[
		"POST",
		"/api/mailboxes",
		"Create a mailbox → { address, created_at, expires_at }",
	],
	["GET", "/api/mailboxes", "Your active mailboxes"],
	["DELETE", "/api/mailboxes/{address}", "Expire a mailbox now"],
	[
		"GET",
		"/api/mailboxes/{address}/messages",
		"Messages: id, from, subject, received_at",
	],
	[
		"GET",
		"/api/mailboxes/{address}/wait",
		"Wait for new mail (?since, ?timeout ≤ 50, ?from, ?subject)",
	],
	["GET", "/api/messages/{id}", "One message with text and html"],
	["DELETE", "/api/messages/{id}", "Delete a message"],
];

const styles = stylex.create({
	// 不用表格：窄屏上第三列会被挤出去。每个端点两行：方法和路径，下面是说明。
	list: { marginBlock: space.lg, padding: 0, listStyle: "none" },
	item: {
		paddingBlock: space.md,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
	},
	route: {
		display: "flex",
		gap: space.md,
		fontFamily: font.mono,
		fontSize: text.sm,
	},
	method: { flexShrink: 0, width: "4.5em", color: color.subtle },
	path: { overflowWrap: "anywhere" },
	body: {
		marginTop: space.xs,
		marginInlineStart: "calc(4.5em + 12px)",
		color: color.muted,
		fontSize: text.sm,
	},
});

export default function ApiDocs() {
	usePageHead({
		title: "smails HTTP API — disposable email for scripts and agents",
		description:
			"The smails HTTP API: create disposable mailboxes, list and read messages, and wait for new mail in a single request. Bearer tokens from GitHub sign-in.",
	});
	return (
		<Article
			eyebrow="Docs"
			title="HTTP API"
			lead="The same operations the CLI and MCP server use. Every request carries a bearer token."
		>
			<H2>Authentication</H2>
			<P>
				Tokens come from GitHub sign-in. The simplest way to get one is the CLI:
				after <InlineCode>npx @smails/cli login</InlineCode>, the access token
				is in <InlineCode>~/.config/smails/credentials.json</InlineCode> (it
				lasts an hour; the CLI refreshes it). Apps can also run the OAuth 2.1
				flow themselves — the authorization server metadata is at{" "}
				<InlineCode>/.well-known/oauth-authorization-server</InlineCode>.
			</P>
			<CodeBlock
				label="terminal"
				code={`TOKEN=$(jq -r '.servers["https://smails.dev"].access_token' ~/.config/smails/credentials.json)
curl -s -X POST https://smails.dev/api/mailboxes -H "Authorization: Bearer $TOKEN"`}
			/>

			<H2>Endpoints</H2>
			<ul {...stylex.attrs(styles.list)}>
				{ENDPOINTS.map(([method, path, body]) => (
					<li {...stylex.attrs(styles.item)}>
						<div {...stylex.attrs(styles.route)}>
							<span {...stylex.attrs(styles.method)}>{method}</span>
							<span {...stylex.attrs(styles.path)}>{path}</span>
						</div>
						<div {...stylex.attrs(styles.body)}>{body}</div>
					</li>
				))}
			</ul>

			<H2>Waiting for mail</H2>
			<P>
				Instead of polling, make one request that returns as soon as a matching
				message arrives (or after <InlineCode>timeout</InlineCode> seconds with{" "}
				<InlineCode>{"{ message: null }"}</InlineCode>
				). Pass <InlineCode>since</InlineCode> (ms since epoch) to include mail
				that arrived before the request.
			</P>
			<CodeBlock
				label="terminal"
				code={`curl -s "https://smails.dev/api/mailboxes/$ADDRESS/wait?subject=code&timeout=50" \\
  -H "Authorization: Bearer $TOKEN" | jq -r .message.text`}
			/>

			<H2>Errors and limits</H2>
			<P>
				Errors are JSON:{" "}
				<InlineCode>
					{'{ "error": "quota_exceeded", "message": "…" }'}
				</InlineCode>
				. 401 means sign in again; 404 means the mailbox or message does not
				exist or is not yours; 429 means today's quota is used up (the{" "}
				<InlineCode>Retry-After</InlineCode> header says when it resets). The
				anonymous API of earlier versions answers 410.
			</P>
			<P>
				Prefer tools over raw HTTP? Use the{" "}
				<Link href="/docs/mcp">MCP server</Link> or the{" "}
				<Link href="/docs/cli">CLI</Link>.
			</P>
		</Article>
	);
}
