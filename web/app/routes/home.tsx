import * as stylex from "@stylexjs/stylex";
import { createSignal } from "solid-js";

import { AgentDemo } from "#/components/agent-demo.tsx";
import { type CodeTab, CodeTabs } from "#/components/code-tabs.tsx";
import { SETUP_PROMPT } from "#/setup.ts";
import {
	color,
	font,
	layout,
	radius,
	space,
	text,
} from "#/ui/tokens.stylex.ts";
import { usePageHead } from "#/utils/head.ts";

// 首页只有一个主要操作：把那句话复制给自己的 agent。每样东西只出现一次：
// 那句话在 hero，演示是唯一的大图，手动配置放在最后给不想用那句话的人。

const MANUAL: CodeTab[] = [
	{
		id: "claude",
		label: "Claude Code",
		caption:
			"Add the server, then run /mcp in Claude Code to sign in with GitHub.",
		code: "claude mcp add --transport http --scope user smails https://smails.dev/mcp",
	},
	{
		id: "codex",
		label: "Codex",
		caption:
			"Add the server and sign in with GitHub in the browser window that opens.",
		code: `codex mcp add smails --url https://smails.dev/mcp
codex mcp login smails`,
	},
	{
		id: "cli",
		label: "CLI",
		caption:
			"From any shell or script: sign in once, then create inboxes and wait for codes.",
		code: `npx @smails/cli login
npx @smails/cli create
npx @smails/cli wait --subject code`,
	},
];

const FEATURES = [
	{
		title: "Waits for the email",
		body: "wait_for_message returns the moment the email lands, with the whole body. No polling loop.",
	},
	{
		title: "Signs in once",
		body: "GitHub sign-in in the browser. Claude Code and Codex keep the session; there are no keys to paste.",
	},
	{
		title: "Free to start",
		body: "20 new inboxes a day per account. Each one lives for 7 days. Receive-only.",
	},
];

const styles = stylex.create({
	container: {
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingInline: space.xl,
	},
	hero: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		paddingTop: { default: space["4xl"], "@media (min-width: 48rem)": "128px" },
		paddingBottom: {
			default: space["3xl"],
			"@media (min-width: 48rem)": space["4xl"],
		},
		textAlign: "center",
	},
	// 给只想在浏览器里收邮件的人：标题正上方一个小链接，第一眼就能看到，又不抢主要操作。
	humanLink: {
		display: "inline-flex",
		alignItems: "center",
		gap: space.sm,
		marginBottom: space["2xl"],
		paddingBlock: space.xs,
		paddingInline: space.md,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: { default: color.border, ":hover": color.borderStrong },
		borderRadius: radius.full,
		color: { default: color.muted, ":hover": color.text },
		fontSize: text.sm,
		whiteSpace: "nowrap",
		textDecoration: "none",
		transitionProperty: "border-color, color",
		transitionDuration: "120ms",
	},
	humanLinkStrong: { color: color.text, fontWeight: 500 },
	title: {
		margin: 0,
		fontSize: "clamp(2.75rem, 1.6rem + 4.6vw, 5rem)",
		fontWeight: 600,
		lineHeight: 1,
		letterSpacing: "-0.045em",
		textWrap: "balance",
	},
	titleSecond: { color: color.subtle },
	lead: {
		maxWidth: "34rem",
		marginBlock: `${space.xl} 0`,
		color: color.muted,
		fontSize: { default: text.md, "@media (min-width: 48rem)": text.lg },
		lineHeight: 1.6,
		textWrap: "pretty",
	},
	prompt: {
		display: "flex",
		alignItems: "center",
		gap: space.lg,
		width: "100%",
		maxWidth: "40rem",
		marginTop: space["2xl"],
		paddingBlock: space.md,
		paddingInlineStart: space.lg,
		paddingInlineEnd: space.md,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: { default: color.borderStrong, ":hover": color.muted },
		borderRadius: radius.lg,
		backgroundColor: color.surface,
		color: color.text,
		fontFamily: font.mono,
		fontSize: text.sm,
		lineHeight: 1.5,
		textAlign: "start",
		cursor: "pointer",
		transitionProperty: "border-color",
		transitionDuration: "120ms",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
		outlineOffset: "3px",
	},
	promptText: { flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" },
	promptMark: { color: color.subtle, marginInlineEnd: space.sm },
	copy: {
		flexShrink: 0,
		paddingBlock: space.xs,
		paddingInline: space.md,
		borderRadius: radius.md,
		backgroundColor: color.accent,
		color: color.onAccent,
		fontFamily: font.sans,
		fontSize: text.sm,
		fontWeight: 500,
	},
	hint: {
		marginBlock: `${space.lg} 0`,
		color: color.subtle,
		fontSize: text.sm,
	},
	hintLink: {
		color: { default: color.muted, ":hover": color.text },
		textUnderlineOffset: "3px",
	},
	demo: {
		maxWidth: "48rem",
		marginInline: "auto",
		paddingBottom: {
			default: space["4xl"],
			"@media (min-width: 48rem)": "128px",
		},
	},
	features: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 48rem)": "repeat(3, minmax(0, 1fr))",
		},
		gap: { default: space["2xl"], "@media (min-width: 48rem)": space["3xl"] },
		paddingBottom: {
			default: space["4xl"],
			"@media (min-width: 48rem)": "128px",
		},
	},
	feature: {
		paddingTop: space.lg,
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: color.border,
	},
	featureTitle: { margin: 0, fontSize: text.md, fontWeight: 500 },
	featureBody: {
		marginBlock: `${space.sm} 0`,
		color: color.muted,
		fontSize: text.sm,
		lineHeight: 1.65,
	},
	setup: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 56rem)": "minmax(0, 0.7fr) minmax(0, 1.3fr)",
		},
		gap: space["2xl"],
		alignItems: "start",
		paddingBottom: {
			default: space["4xl"],
			"@media (min-width: 48rem)": "128px",
		},
		scrollMarginTop: "6rem",
	},
	setupTitle: {
		margin: 0,
		fontSize: text.xl,
		fontWeight: 600,
		letterSpacing: "-0.03em",
	},
	setupText: {
		marginBlock: `${space.md} 0`,
		maxWidth: "22rem",
		color: color.muted,
		fontSize: text.sm,
	},
});

function PromptBox() {
	const [copied, setCopied] = createSignal(false);
	const copy = async () => {
		await navigator.clipboard.writeText(SETUP_PROMPT);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};
	return (
		<button
			type="button"
			aria-label="Copy the setup prompt"
			onClick={() => void copy()}
			{...stylex.attrs(styles.prompt)}
		>
			<span {...stylex.attrs(styles.promptText)}>
				<span {...stylex.attrs(styles.promptMark)}>›</span>
				{SETUP_PROMPT}
			</span>
			<span {...stylex.attrs(styles.copy)}>{copied() ? "Copied" : "Copy"}</span>
		</button>
	);
}

export default function Home() {
	usePageHead({
		title: "smails — email inboxes for AI agents",
		description:
			"Give your AI agent its own email address. It signs up, waits for the verification email and reads the code on its own. Set up Claude Code or Codex with one sentence.",
	});
	return (
		<>
			<section {...stylex.attrs(styles.container, styles.hero)}>
				<a href="https://smail.pw" {...stylex.attrs(styles.humanLink)}>
					Just need an inbox?
					<span {...stylex.attrs(styles.humanLinkStrong)}>Use smail.pw →</span>
				</a>
				<h1 {...stylex.attrs(styles.title)}>
					Email inboxes
					<br />
					<span {...stylex.attrs(styles.titleSecond)}>for AI agents.</span>
				</h1>
				<p {...stylex.attrs(styles.lead)}>
					Give your agent its own address. It signs up, waits for the
					verification email and reads the code — on its own.
				</p>
				<PromptBox />
				<p {...stylex.attrs(styles.hint)}>
					Paste it into Claude Code or Codex.{" "}
					<a href="#setup" {...stylex.attrs(styles.hintLink)}>
						Or set it up yourself
					</a>
				</p>
			</section>

			<div {...stylex.attrs(styles.container)}>
				<div {...stylex.attrs(styles.demo)}>
					<AgentDemo />
				</div>

				<div {...stylex.attrs(styles.features)}>
					{FEATURES.map((feature) => (
						<div {...stylex.attrs(styles.feature)}>
							<h2 {...stylex.attrs(styles.featureTitle)}>{feature.title}</h2>
							<p {...stylex.attrs(styles.featureBody)}>{feature.body}</p>
						</div>
					))}
				</div>

				<section id="setup" {...stylex.attrs(styles.setup)}>
					<div>
						<h2 {...stylex.attrs(styles.setupTitle)}>Set it up yourself</h2>
						<p {...stylex.attrs(styles.setupText)}>
							The same thing the sentence above asks your agent to do.
						</p>
					</div>
					<CodeTabs tabs={MANUAL} />
				</section>
			</div>
		</>
	);
}
