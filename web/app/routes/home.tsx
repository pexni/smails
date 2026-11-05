import * as stylex from "@stylexjs/stylex";

import { ButtonLink } from "#/ui/Button.tsx";
import { CodeBlock } from "#/ui/Code.tsx";
import {
	color,
	font,
	layout,
	radius,
	space,
	text,
} from "#/ui/tokens.stylex.ts";
import { usePageHead } from "#/utils/head.ts";

const MCP_URL = "https://smails.dev/mcp";

const CLI = `npx @smails/cli login          # once: confirm in the browser
npx @smails/cli create         # → brave-otter-k3j9x2m8@smails.dev
npx @smails/cli wait --subject code`;

const STEPS = [
	{
		title: "Create an inbox",
		body: "The agent calls create_mailbox and gets a fresh address in milliseconds.",
	},
	{
		title: "Sign up anywhere",
		body: "It uses the address on the site it is working with, like any person would.",
	},
	{
		title: "Wait for the code",
		body: "wait_for_message blocks until the email lands and returns the whole body. No polling loop.",
	},
];

const FACTS = [
	{
		title: "Built for agents",
		body: "Remote MCP with OAuth, a local MCP server, a CLI and a plain HTTP API.",
	},
	{
		title: "Push, not polling",
		body: "Waiting is one request that returns the moment mail arrives.",
	},
	{
		title: "Sign in once",
		body: "GitHub sign-in in the browser; the CLI and MCP clients share it.",
	},
	{
		title: "Free",
		body: "20 new mailboxes a day per account. Each one lives for 7 days. Receive-only.",
	},
];

const styles = stylex.create({
	hero: {
		maxWidth: layout.content,
		paddingTop: space["4xl"],
		paddingBottom: space["3xl"],
	},
	title: {
		margin: 0,
		fontSize: text["3xl"],
		lineHeight: 1.05,
		letterSpacing: "-0.03em",
		textWrap: "balance",
	},
	lead: {
		marginBlock: `${space.xl} 0`,
		color: color.muted,
		fontSize: text.lg,
		textWrap: "pretty",
	},
	actions: {
		display: "flex",
		flexWrap: "wrap",
		gap: space.md,
		marginTop: space["2xl"],
	},
	grid: {
		display: "grid",
		gridTemplateColumns: {
			// minmax(0, …)：代码块里的长行在块内横向滚动，不把整列（和页面）撑宽。
			default: "minmax(0, 1fr)",
			"@media (min-width: 48rem)": "repeat(2, minmax(0, 1fr))",
		},
		gap: space.xl,
	},
	sectionTitle: {
		marginBlock: `${space["3xl"]} ${space.lg}`,
		fontSize: text.xl,
		letterSpacing: "-0.01em",
	},
	steps: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 48rem)": "repeat(3, minmax(0, 1fr))",
		},
		gap: space.xl,
		margin: 0,
		padding: 0,
		listStyle: "none",
		counterReset: "step",
	},
	step: {
		paddingTop: space.lg,
		borderTopWidth: "2px",
		borderTopStyle: "solid",
		borderTopColor: color.text,
	},
	stepNumber: { color: color.subtle, fontFamily: font.mono, fontSize: text.sm },
	itemTitle: { marginBlock: `${space.xs} ${space.xs}`, fontSize: text.md },
	itemBody: { margin: 0, color: color.muted },
	facts: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 40rem)": "repeat(2, minmax(0, 1fr))",
		},
		gap: space.xl,
	},
	humans: {
		marginTop: space["3xl"],
		paddingBlock: space.xl,
		paddingInline: space.xl,
		borderRadius: radius.lg,
		backgroundColor: color.surface,
	},
	humansLink: { color: color.accent, fontWeight: 600 },
	label: { margin: 0, color: color.subtle, fontSize: text.sm },
});

export default function Home() {
	usePageHead({
		title: "smails — disposable email for AI agents (MCP, CLI, API)",
		description:
			"Give your AI agent its own disposable inbox. Create an address, sign up anywhere, and wait for the verification code or magic link — over remote MCP, a local MCP server, a CLI or HTTP.",
	});
	return (
		<>
			<section {...stylex.attrs(styles.hero)}>
				<h1 {...stylex.attrs(styles.title)}>Disposable email for AI agents.</h1>
				<p {...stylex.attrs(styles.lead)}>
					Give your agent its own inbox. It creates an address, signs up, and
					waits for the verification code — over MCP or the command line.
				</p>
				<div {...stylex.attrs(styles.actions)}>
					<ButtonLink href="/docs/mcp">Connect over MCP</ButtonLink>
					<ButtonLink href="/docs/cli" variant="outline">
						Use the CLI
					</ButtonLink>
				</div>
			</section>

			<div {...stylex.attrs(styles.grid)}>
				<div>
					<p {...stylex.attrs(styles.label)}>
						Remote MCP server — add this URL to your MCP client
					</p>
					<CodeBlock label="MCP" code={MCP_URL} />
				</div>
				<div>
					<p {...stylex.attrs(styles.label)}>Or from a terminal</p>
					<CodeBlock label="terminal" code={CLI} />
				</div>
			</div>

			<h2 {...stylex.attrs(styles.sectionTitle)}>How it works</h2>
			<ol {...stylex.attrs(styles.steps)}>
				{STEPS.map((step, index) => (
					<li {...stylex.attrs(styles.step)}>
						<span {...stylex.attrs(styles.stepNumber)}>0{index + 1}</span>
						<h3 {...stylex.attrs(styles.itemTitle)}>{step.title}</h3>
						<p {...stylex.attrs(styles.itemBody)}>{step.body}</p>
					</li>
				))}
			</ol>

			<h2 {...stylex.attrs(styles.sectionTitle)}>Why smails</h2>
			<div {...stylex.attrs(styles.facts)}>
				{FACTS.map((fact) => (
					<div>
						<h3 {...stylex.attrs(styles.itemTitle)}>{fact.title}</h3>
						<p {...stylex.attrs(styles.itemBody)}>{fact.body}</p>
					</div>
				))}
			</div>

			<aside {...stylex.attrs(styles.humans)}>
				<h2 {...stylex.attrs(styles.itemTitle)}>
					Need a throwaway inbox yourself?
				</h2>
				<p {...stylex.attrs(styles.itemBody)}>
					smails is made for agents. For an inbox in your browser, use{" "}
					<a href="https://smail.pw" {...stylex.attrs(styles.humansLink)}>
						smail.pw
					</a>{" "}
					— no sign-in, open the page and you have an address.
				</p>
			</aside>
		</>
	);
}
