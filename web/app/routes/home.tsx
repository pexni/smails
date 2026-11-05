import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createSignal } from "solid-js";

import { AgentDemo } from "#/components/agent-demo.tsx";
import { type CodeTab, CodeTabs } from "#/components/code-tabs.tsx";
import { ButtonLink } from "#/ui/Button.tsx";
import {
	color,
	font,
	layout,
	radius,
	space,
	text,
} from "#/ui/tokens.stylex.ts";
import { usePageHead } from "#/utils/head.ts";

const INSTALL = "npx @smails/cli login";

const CONNECT: CodeTab[] = [
	{
		id: "mcp",
		label: "Remote MCP",
		caption:
			"Add the server to your MCP client. It opens a browser window once to sign in with GitHub.",
		code: `# Claude Code
claude mcp add --transport http smails https://smails.dev/mcp

# Cursor, VS Code, Claude and other clients: add this URL
https://smails.dev/mcp`,
	},
	{
		id: "cli",
		label: "CLI",
		caption:
			"Sign in once, then create inboxes and wait for codes from any shell or script.",
		code: `npx @smails/cli login                 # confirm in the browser
npx @smails/cli create                # → brave-otter-k3j9x2m8@smails.dev
npx @smails/cli wait --subject code   # blocks until the email arrives`,
	},
	{
		id: "http",
		label: "HTTP",
		caption: "One request waits for the next email — no polling loop.",
		code: `curl -X POST https://smails.dev/api/mailboxes \\
  -H "Authorization: Bearer $TOKEN"

curl "https://smails.dev/api/mailboxes/$ADDRESS/wait?subject=code" \\
  -H "Authorization: Bearer $TOKEN"`,
	},
];

type Feature = { title: string; body: string; icon: () => JSX.Element };

const icon = (path: string) => () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d={path} />
	</svg>
);

const FEATURES: Feature[] = [
	{
		title: "Push, not polling",
		body: "wait_for_message returns the moment the email lands, with the full body. One call instead of a loop.",
		icon: icon("M13 2 3 14h9l-1 8 10-12h-9l1-8z"),
	},
	{
		title: "Built for agents",
		body: "A remote MCP server with OAuth, a local stdio server, a CLI and a plain HTTP API — same tools everywhere.",
		icon: icon("m4 17 6-6-6-6 M12 19h8"),
	},
	{
		title: "Sign in once",
		body: "GitHub sign-in in the browser. MCP clients and the CLI keep the session; there are no API keys to paste.",
		icon: icon(
			"M15 7a4 4 0 1 1-3.5 6L4 20.5V17h3v-3h3l1.5-1.5A4 4 0 0 1 15 7z M16 9h.01",
		),
	},
	{
		title: "Free to start",
		body: "20 new inboxes a day per account. Each one lives for 7 days. Receive-only, no setup.",
		icon: icon(
			"M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
		),
	},
];

const STEPS = [
	{
		title: "Create an inbox",
		body: "create_mailbox returns a fresh address in milliseconds.",
		code: "create_mailbox()",
	},
	{
		title: "Sign up anywhere",
		body: "The agent uses the address on the site it is working with.",
		code: "fill(email, address)",
	},
	{
		title: "Read the code",
		body: "wait_for_message blocks until the email arrives, then returns it.",
		code: 'wait_for_message({ subject: "code" })',
	},
];

const CLIENTS = [
	"Claude Code",
	"Claude",
	"Cursor",
	"VS Code",
	"Any MCP client",
];

const styles = stylex.create({
	// —— hero ——
	hero: {
		position: "relative",
		overflow: "hidden",
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
	},
	// 细网格，越往边缘越淡。
	grid: {
		position: "absolute",
		inset: 0,
		backgroundImage: `linear-gradient(${color.grid} 1px, transparent 1px), linear-gradient(90deg, ${color.grid} 1px, transparent 1px)`,
		backgroundSize: "44px 44px",
		maskImage:
			"radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)",
		pointerEvents: "none",
	},
	// 光晕在终端窗口后面，四周都淡出，不贴着 header 留下硬边。
	glow: {
		position: "absolute",
		top: "50%",
		insetInlineEnd: "-8rem",
		width: "48rem",
		height: "40rem",
		transform: "translateY(-50%)",
		backgroundImage: `radial-gradient(closest-side, ${color.glow}, transparent)`,
		pointerEvents: "none",
	},
	heroInner: {
		position: "relative",
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 60rem)": "minmax(0, 1fr) minmax(0, 1.05fr)",
		},
		alignItems: "center",
		gap: { default: space["3xl"], "@media (min-width: 60rem)": space["4xl"] },
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingInline: space.xl,
		paddingBlock: {
			default: space["3xl"],
			"@media (min-width: 60rem)": space["4xl"],
		},
	},
	pill: {
		display: "inline-flex",
		alignItems: "center",
		gap: space.sm,
		paddingBlock: space.xs,
		paddingInline: space.md,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.full,
		backgroundColor: color.surface,
		color: color.muted,
		fontSize: text.xs,
		fontWeight: 500,
	},
	pillDot: {
		width: "6px",
		height: "6px",
		borderRadius: radius.full,
		backgroundColor: color.accent,
	},
	title: {
		marginBlock: `${space.xl} 0`,
		fontSize: text["3xl"],
		fontWeight: 700,
		lineHeight: 1.02,
		letterSpacing: "-0.045em",
		textWrap: "balance",
	},
	titleAccent: {
		backgroundImage: `linear-gradient(180deg, ${color.text} 30%, ${color.subtle} 110%)`,
		backgroundClip: "text",
		color: "transparent",
	},
	lead: {
		maxWidth: "32rem",
		marginBlock: `${space.xl} 0`,
		color: color.muted,
		fontSize: text.lg,
		lineHeight: 1.6,
		textWrap: "pretty",
	},
	actions: {
		display: "flex",
		flexWrap: "wrap",
		gap: space.md,
		marginTop: space["2xl"],
	},
	install: {
		display: "inline-flex",
		alignItems: "center",
		gap: space.md,
		marginTop: space.xl,
		paddingBlock: space.sm,
		paddingInline: space.md,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: { default: color.border, ":hover": color.borderStrong },
		borderRadius: radius.md,
		backgroundColor: "transparent",
		color: color.muted,
		fontFamily: font.mono,
		fontSize: text.sm,
		cursor: "pointer",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
	},
	dollar: { color: color.subtle },
	copyHint: { color: color.subtle, fontFamily: font.sans, fontSize: text.xs },
	// —— sections ——
	section: {
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingInline: space.xl,
		// 各段之间：手机 48px，桌面 80px（上下各一份，叠起来正好）。
		paddingBlock: {
			default: space["3xl"],
			"@media (min-width: 60rem)": "80px",
		},
	},
	clients: {
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "center",
		gap: { default: space.lg, "@media (min-width: 40rem)": space["2xl"] },
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingBlock: space["2xl"],
		paddingInline: space.xl,
		color: color.subtle,
		fontSize: text.sm,
	},
	clientsLabel: { color: color.muted },
	client: { fontFamily: font.mono, letterSpacing: "-0.01em" },
	eyebrow: {
		margin: 0,
		color: color.accentText,
		fontFamily: font.mono,
		fontSize: text.xs,
		fontWeight: 600,
		letterSpacing: "0.08em",
		textTransform: "uppercase",
	},
	sectionTitle: {
		maxWidth: "36rem",
		marginBlock: `${space.md} ${space["2xl"]}`,
		fontSize: text["2xl"],
		lineHeight: 1.12,
		letterSpacing: "-0.03em",
		textWrap: "balance",
	},
	features: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 40rem)": "repeat(2, minmax(0, 1fr))",
			"@media (min-width: 64rem)": "repeat(4, minmax(0, 1fr))",
		},
		gap: space.lg,
	},
	card: {
		position: "relative",
		paddingBlock: space.xl,
		paddingInline: space.xl,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: { default: color.border, ":hover": color.borderStrong },
		borderRadius: radius.lg,
		backgroundColor: color.surface,
		transitionProperty: "border-color, transform",
		transitionDuration: "160ms",
		transform: { default: "none", ":hover": "translateY(-2px)" },
	},
	iconBox: {
		display: "inline-grid",
		placeItems: "center",
		width: "2.25rem",
		height: "2.25rem",
		borderRadius: radius.md,
		backgroundColor: color.accentSoft,
		color: color.accentText,
	},
	cardTitle: {
		marginBlock: `${space.lg} ${space.sm}`,
		fontSize: text.md,
		fontWeight: 600,
	},
	cardBody: {
		margin: 0,
		color: color.muted,
		fontSize: text.sm,
		lineHeight: 1.6,
	},
	split: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 60rem)": "minmax(0, 0.8fr) minmax(0, 1.2fr)",
		},
		gap: space["3xl"],
		alignItems: "start",
	},
	splitText: {
		margin: 0,
		color: color.muted,
		fontSize: text.lg,
		maxWidth: "26rem",
	},
	steps: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 48rem)": "repeat(3, minmax(0, 1fr))",
		},
		gap: space.lg,
		margin: 0,
		padding: 0,
		listStyle: "none",
	},
	step: {
		paddingTop: space.xl,
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: color.borderStrong,
	},
	stepNumber: {
		color: color.accentText,
		fontFamily: font.mono,
		fontSize: text.sm,
	},
	stepCode: {
		display: "block",
		marginTop: space.lg,
		color: color.subtle,
		fontFamily: font.mono,
		fontSize: text.xs,
		overflowWrap: "anywhere",
	},
	// —— 结尾 ——
	cta: {
		position: "relative",
		overflow: "hidden",
		paddingBlock: space["4xl"],
		paddingInline: space["2xl"],
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.xl,
		backgroundColor: color.surface,
		textAlign: "center",
	},
	ctaGlow: {
		position: "absolute",
		insetInline: 0,
		bottom: "-60%",
		height: "100%",
		backgroundImage: `radial-gradient(ellipse at center, ${color.glow}, transparent 60%)`,
		pointerEvents: "none",
	},
	ctaTitle: {
		position: "relative",
		marginBlock: `0 ${space.md}`,
		fontSize: text["2xl"],
		letterSpacing: "-0.03em",
	},
	ctaText: { position: "relative", margin: 0, color: color.muted },
	ctaActions: {
		position: "relative",
		display: "flex",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: space.md,
		marginTop: space["2xl"],
	},
	humans: {
		marginTop: space.xl,
		color: color.subtle,
		fontSize: text.sm,
		textAlign: "center",
	},
	humansLink: { color: color.text, textUnderlineOffset: "3px" },
});

function InstallChip() {
	const [copied, setCopied] = createSignal(false);
	const copy = async () => {
		await navigator.clipboard.writeText(INSTALL);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};
	return (
		<button
			type="button"
			onClick={() => void copy()}
			{...stylex.attrs(styles.install)}
		>
			<span>
				<span {...stylex.attrs(styles.dollar)}>$ </span>
				{INSTALL}
			</span>
			<span {...stylex.attrs(styles.copyHint)}>
				{copied() ? "Copied" : "Copy"}
			</span>
		</button>
	);
}

export default function Home() {
	usePageHead({
		title: "smails — email inboxes for AI agents (MCP, CLI, API)",
		description:
			"Give your AI agent its own disposable inbox. It creates an address, signs up anywhere and waits for the verification code or magic link — over remote MCP, a CLI or HTTP.",
	});
	return (
		<>
			<section {...stylex.attrs(styles.hero)}>
				<div {...stylex.attrs(styles.grid)} />
				<div {...stylex.attrs(styles.glow)} />
				<div {...stylex.attrs(styles.heroInner)}>
					<div>
						<span {...stylex.attrs(styles.pill)}>
							<span {...stylex.attrs(styles.pillDot)} />
							Remote MCP · OAuth · CLI
						</span>
						<h1 {...stylex.attrs(styles.title)}>
							Email inboxes for{" "}
							<span {...stylex.attrs(styles.titleAccent)}>AI agents.</span>
						</h1>
						<p {...stylex.attrs(styles.lead)}>
							Your agent creates an address, signs up anywhere, and waits for
							the verification code or magic link — then keeps going on its own.
						</p>
						<div {...stylex.attrs(styles.actions)}>
							<ButtonLink href="/docs/mcp" variant="accent">
								Connect over MCP
							</ButtonLink>
							<ButtonLink href="/docs/cli" variant="outline">
								Use the CLI
							</ButtonLink>
						</div>
						<InstallChip />
					</div>
					<AgentDemo />
				</div>
			</section>

			<div {...stylex.attrs(styles.clients)}>
				<span {...stylex.attrs(styles.clientsLabel)}>Works with</span>
				{CLIENTS.map((client) => (
					<span {...stylex.attrs(styles.client)}>{client}</span>
				))}
			</div>

			<section {...stylex.attrs(styles.section)}>
				<p {...stylex.attrs(styles.eyebrow)}>Why smails</p>
				<h2 {...stylex.attrs(styles.sectionTitle)}>
					Everything an agent needs to get past “check your email”.
				</h2>
				<div {...stylex.attrs(styles.features)}>
					{FEATURES.map((feature) => (
						<div {...stylex.attrs(styles.card)}>
							<span {...stylex.attrs(styles.iconBox)}>{feature.icon()}</span>
							<h3 {...stylex.attrs(styles.cardTitle)}>{feature.title}</h3>
							<p {...stylex.attrs(styles.cardBody)}>{feature.body}</p>
						</div>
					))}
				</div>
			</section>

			<section {...stylex.attrs(styles.section)}>
				<div {...stylex.attrs(styles.split)}>
					<div>
						<p {...stylex.attrs(styles.eyebrow)}>Connect</p>
						<h2 {...stylex.attrs(styles.sectionTitle)}>
							Up and running in a minute.
						</h2>
						<p {...stylex.attrs(styles.splitText)}>
							Point any MCP client at the remote server, or use the CLI from a
							shell. Both sign in once with GitHub and share the same tools.
						</p>
					</div>
					<CodeTabs tabs={CONNECT} />
				</div>
			</section>

			<section {...stylex.attrs(styles.section)}>
				<p {...stylex.attrs(styles.eyebrow)}>How it works</p>
				<h2 {...stylex.attrs(styles.sectionTitle)}>
					Three tool calls, no polling.
				</h2>
				<ol {...stylex.attrs(styles.steps)}>
					{STEPS.map((step, index) => (
						<li {...stylex.attrs(styles.step)}>
							<span {...stylex.attrs(styles.stepNumber)}>0{index + 1}</span>
							<h3 {...stylex.attrs(styles.cardTitle)}>{step.title}</h3>
							<p {...stylex.attrs(styles.cardBody)}>{step.body}</p>
							<code {...stylex.attrs(styles.stepCode)}>{step.code}</code>
						</li>
					))}
				</ol>
			</section>

			<section {...stylex.attrs(styles.section)}>
				<div {...stylex.attrs(styles.cta)}>
					<div {...stylex.attrs(styles.ctaGlow)} />
					<h2 {...stylex.attrs(styles.ctaTitle)}>Give your agent an inbox.</h2>
					<p {...stylex.attrs(styles.ctaText)}>
						Free to start. Sign in with GitHub when your client asks.
					</p>
					<div {...stylex.attrs(styles.ctaActions)}>
						<ButtonLink href="/docs/mcp" variant="accent">
							Connect over MCP
						</ButtonLink>
						<ButtonLink href="/docs/api" variant="outline">
							Read the API docs
						</ButtonLink>
					</div>
				</div>
				<p {...stylex.attrs(styles.humans)}>
					Need a throwaway inbox yourself, in the browser?{" "}
					<a href="https://smail.pw" {...stylex.attrs(styles.humansLink)}>
						Use smail.pw →
					</a>
				</p>
			</section>
		</>
	);
}
