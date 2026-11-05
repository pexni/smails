import * as stylex from "@stylexjs/stylex";
import { createSignal, For, Match, onSettled, Switch } from "solid-js";

import { color, font, radius, space, text } from "#/ui/tokens.stylex.ts";

// 首页右边的终端窗口：一行行演示 agent 用 smails 完成一次注册。
// 预渲染的 HTML 里是全部内容（没有脚本、或者系统设置了“减少动态效果”时就停在这里）；
// 浏览器接管后从头开始播放，播完停一会儿再循环。每一行的高度事先就占好，播放时页面不会跳。

type Step =
	| { kind: "user"; text: string }
	| { kind: "tool"; name: string; args?: string }
	| { kind: "result"; text: string }
	| { kind: "note"; text: string }
	| { kind: "wait"; text: string }
	| { kind: "mail"; from: string; subject: string; code: string }
	| { kind: "done"; text: string };

const STEPS: Step[] = [
	{ kind: "user", text: "Sign up for Acme with a fresh email and confirm it." },
	{ kind: "tool", name: "create_mailbox" },
	{ kind: "result", text: "brave-otter-k3j9x2m8@smails.dev" },
	{ kind: "note", text: "Filling in the sign-up form at acme.dev…" },
	{ kind: "tool", name: "wait_for_message", args: 'subject: "code"' },
	{ kind: "wait", text: "waiting for mail" },
	{
		kind: "mail",
		from: "Acme <noreply@acme.dev>",
		subject: "Your Acme verification code",
		code: "482913",
	},
	{ kind: "done", text: "Entered 482913 — account verified." },
];

// 每一行出现之后停多久再出下一行（毫秒）；最后一个是播完后停留的时间。
const DELAYS = [900, 700, 900, 1300, 700, 1900, 1500, 3400];

const appear = stylex.keyframes({
	from: { opacity: 0, transform: "translateY(4px)" },
	to: { opacity: 1, transform: "translateY(0)" },
});

const pulse = stylex.keyframes({
	"0%, 100%": { opacity: 0.25 },
	"50%": { opacity: 1 },
});

const styles = stylex.create({
	window: {
		position: "relative",
		overflow: "hidden",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.borderStrong,
		borderRadius: radius.xl,
		backgroundColor: color.surface,
		boxShadow:
			"0 30px 80px -30px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.02) inset",
	},
	bar: {
		display: "flex",
		alignItems: "center",
		gap: space.sm,
		paddingBlock: space.md,
		paddingInline: space.lg,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		backgroundColor: color.raised,
	},
	dot: {
		width: "10px",
		height: "10px",
		borderRadius: radius.full,
		backgroundColor: color.borderStrong,
	},
	barTitle: {
		marginInlineStart: space.sm,
		color: color.subtle,
		fontFamily: font.mono,
		fontSize: text.xs,
	},
	live: {
		marginInlineStart: "auto",
		display: "inline-flex",
		alignItems: "center",
		gap: space.xs,
		color: color.subtle,
		fontFamily: font.mono,
		fontSize: text.xs,
	},
	liveDot: {
		width: "6px",
		height: "6px",
		borderRadius: radius.full,
		backgroundColor: color.accent,
		boxShadow: `0 0 8px ${color.accent}`,
	},
	body: {
		display: "grid",
		gap: space.md,
		paddingBlock: space.xl,
		paddingInline: space.xl,
		fontFamily: font.mono,
		fontSize: { default: "0.8125rem", "@media (min-width: 30rem)": text.sm },
		lineHeight: 1.6,
		minHeight: "24rem",
		alignContent: "start",
	},
	line: { opacity: 0 },
	shown: {
		opacity: 1,
		animationName: appear,
		animationDuration: "320ms",
		animationTimingFunction: "ease-out",
	},
	user: { color: color.text },
	userMark: { color: color.termPrompt, marginInlineEnd: space.sm },
	tool: { color: color.muted },
	toolName: { color: color.termTool },
	result: {
		paddingInlineStart: space.lg,
		color: color.text,
		overflowWrap: "anywhere",
	},
	arrow: { color: color.subtle, marginInlineEnd: space.sm },
	note: { color: color.subtle, fontStyle: "italic" },
	wait: {
		display: "inline-flex",
		gap: "2px",
		paddingInlineStart: space.lg,
		color: color.subtle,
	},
	waitDot: {
		animationName: pulse,
		animationDuration: "1.2s",
		animationIterationCount: "infinite",
	},
	mail: {
		marginInlineStart: space.lg,
		paddingBlock: space.md,
		paddingInline: space.lg,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.md,
		backgroundColor: color.raised,
		fontFamily: font.sans,
	},
	mailMeta: { color: color.subtle, fontSize: text.xs },
	mailSubject: { color: color.text, fontWeight: 600 },
	mailBody: { marginTop: space.sm, color: color.muted },
	code: {
		display: "inline-block",
		marginInlineStart: space.xs,
		paddingInline: space.sm,
		borderRadius: radius.sm,
		backgroundColor: color.accentSoft,
		color: color.accentText,
		fontFamily: font.mono,
		fontWeight: 700,
		letterSpacing: "0.08em",
	},
	done: { color: color.accentText },
});

export function AgentDemo() {
	// 预渲染时（以及不播放时）显示全部行。
	const [shown, setShown] = createSignal(STEPS.length);

	onSettled(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}
		let step = 0;
		let timer: ReturnType<typeof setTimeout>;
		const next = () => {
			step = step >= STEPS.length ? 0 : step + 1;
			setShown(step);
			timer = setTimeout(next, step === 0 ? 400 : (DELAYS[step - 1] ?? 1000));
		};
		setShown(0);
		timer = setTimeout(next, 500);
		return () => clearTimeout(timer);
	});

	const visible = (index: number) => index < shown();
	// “等待中”那一行只在它是最后出现的一行时闪动。
	const waiting = (index: number) => shown() === index + 1;

	return (
		<div
			role="img"
			aria-label="An AI agent creates a smails mailbox, signs up, waits for the verification email and reads the code 482913."
			{...stylex.attrs(styles.window)}
		>
			<div {...stylex.attrs(styles.bar)}>
				<span {...stylex.attrs(styles.dot)} />
				<span {...stylex.attrs(styles.dot)} />
				<span {...stylex.attrs(styles.dot)} />
				<span {...stylex.attrs(styles.barTitle)}>agent · smails MCP</span>
				<span {...stylex.attrs(styles.live)}>
					<span {...stylex.attrs(styles.liveDot)} />
					connected
				</span>
			</div>
			<div aria-hidden="true" {...stylex.attrs(styles.body)}>
				<For each={STEPS}>
					{(step, index) => (
						<div
							{...stylex.attrs(styles.line, visible(index()) && styles.shown)}
						>
							<Switch>
								<Match when={step.kind === "user" && step}>
									{(s) => (
										<div {...stylex.attrs(styles.user)}>
											<span {...stylex.attrs(styles.userMark)}>›</span>
											{s().text}
										</div>
									)}
								</Match>
								<Match when={step.kind === "tool" && step}>
									{(s) => (
										<div {...stylex.attrs(styles.tool)}>
											<span {...stylex.attrs(styles.arrow)}>⏺</span>
											<span {...stylex.attrs(styles.toolName)}>{s().name}</span>
											({s().args ?? ""})
										</div>
									)}
								</Match>
								<Match when={step.kind === "result" && step}>
									{(s) => (
										<div {...stylex.attrs(styles.result)}>
											<span {...stylex.attrs(styles.arrow)}>⎿</span>
											{s().text}
										</div>
									)}
								</Match>
								<Match when={step.kind === "note" && step}>
									{(s) => <div {...stylex.attrs(styles.note)}>{s().text}</div>}
								</Match>
								<Match when={step.kind === "wait" && step}>
									{(s) => (
										<div {...stylex.attrs(styles.wait)}>
											<span {...stylex.attrs(styles.arrow)}>⎿</span>
											{s().text}
											<span
												{...stylex.attrs(waiting(index()) && styles.waitDot)}
											>
												.
											</span>
											<span
												{...stylex.attrs(waiting(index()) && styles.waitDot)}
											>
												.
											</span>
											<span
												{...stylex.attrs(waiting(index()) && styles.waitDot)}
											>
												.
											</span>
										</div>
									)}
								</Match>
								<Match when={step.kind === "mail" && step}>
									{(s) => (
										<div {...stylex.attrs(styles.mail)}>
											<div {...stylex.attrs(styles.mailMeta)}>{s().from}</div>
											<div {...stylex.attrs(styles.mailSubject)}>
												{s().subject}
											</div>
											<div {...stylex.attrs(styles.mailBody)}>
												Your code is
												<span {...stylex.attrs(styles.code)}>{s().code}</span>
											</div>
										</div>
									)}
								</Match>
								<Match when={step.kind === "done" && step}>
									{(s) => (
										<div {...stylex.attrs(styles.done)}>✓ {s().text}</div>
									)}
								</Match>
							</Switch>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}
