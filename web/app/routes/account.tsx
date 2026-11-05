import * as stylex from "@stylexjs/stylex";
import { createSignal, For, Loading, Match, Show, Switch } from "solid-js";

import { getAccount, revokeSession, signInHref, signOut } from "#/api.ts";
import { ButtonLink } from "#/ui/Button.tsx";
import {
	color,
	font,
	layout,
	radius,
	space,
	text,
} from "#/ui/tokens.stylex.ts";
import { useClientData } from "#/utils/client-data.ts";
import { usePageHead } from "#/utils/head.ts";

import type { Account } from "../../../worker/src/contract.ts";

// 账号页：一个普通的页面（不是弹窗式的卡片），和文档页同样的宽度。
// 上面是身份，中间是用量，下面是已登录的应用。破坏性的操作用低调的文字按钮，不用红色大按钮。

const styles = stylex.create({
	page: {
		maxWidth: layout.content,
		marginInline: "auto",
		paddingInline: space.xl,
		paddingTop: {
			default: space["3xl"],
			"@media (min-width: 48rem)": space["4xl"],
		},
		paddingBottom: space["4xl"],
	},
	identity: { display: "flex", alignItems: "center", gap: space.lg },
	avatar: {
		flexShrink: 0,
		width: "3.5rem",
		height: "3.5rem",
		borderRadius: radius.full,
		backgroundColor: color.raised,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
	},
	who: { flexGrow: 1, minWidth: 0 },
	login: {
		margin: 0,
		fontSize: text.xl,
		fontWeight: 600,
		letterSpacing: "-0.03em",
		lineHeight: 1.2,
	},
	email: {
		margin: 0,
		color: color.muted,
		fontSize: text.sm,
		overflowWrap: "anywhere",
	},
	section: { marginTop: space["3xl"] },
	sectionTitle: {
		margin: 0,
		paddingBottom: space.md,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		color: color.subtle,
		fontSize: text.xs,
		fontWeight: 500,
		letterSpacing: "0.06em",
		textTransform: "uppercase",
	},
	row: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.lg,
		paddingBlock: space.md,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		fontSize: text.sm,
	},
	label: { color: color.muted },
	value: {
		color: color.text,
		fontVariantNumeric: "tabular-nums",
		textAlign: "end",
	},
	bar: {
		height: "4px",
		marginTop: space.sm,
		borderRadius: radius.full,
		backgroundColor: color.raised,
		overflow: "hidden",
	},
	barFill: {
		height: "100%",
		borderRadius: radius.full,
		backgroundColor: color.accent,
	},
	usageRow: {
		paddingBlock: space.md,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		fontSize: text.sm,
	},
	usageHead: {
		display: "flex",
		justifyContent: "space-between",
		gap: space.lg,
	},
	list: { margin: 0, padding: 0, listStyle: "none" },
	app: { minWidth: 0 },
	appName: { color: color.text },
	appMeta: { color: color.subtle, fontSize: text.xs },
	textButton: {
		flexShrink: 0,
		padding: 0,
		borderWidth: 0,
		backgroundColor: "transparent",
		color: { default: color.subtle, ":hover": color.text },
		fontFamily: font.sans,
		fontSize: text.sm,
		cursor: "pointer",
		textDecoration: { default: "none", ":hover": "underline" },
		textUnderlineOffset: "3px",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
		outlineOffset: "3px",
	},
	empty: { marginBlock: space.md, color: color.subtle, fontSize: text.sm },
	error: { marginBlock: space.md, color: color.danger, fontSize: text.sm },
	center: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		textAlign: "center",
		paddingTop: space["4xl"],
	},
	centerTitle: {
		margin: 0,
		fontSize: text.xl,
		fontWeight: 600,
		letterSpacing: "-0.03em",
	},
	centerText: {
		marginBlock: `${space.md} ${space.xl}`,
		maxWidth: "24rem",
		color: color.muted,
	},
	muted: { color: color.subtle, fontSize: text.sm },
});

const dateTime = (ms: number) =>
	new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(ms);

function resetsIn(ms: number): string {
	const minutes = Math.max(0, Math.round((ms - Date.now()) / 60_000));
	if (minutes < 60) {
		return `in ${minutes} min`;
	}
	return `in ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function AccountView(props: { account: Account; onChange: () => void }) {
	const [failure, setFailure] = createSignal("");
	const used = () => props.account.quota.mailboxes_today;
	const limit = () => props.account.quota.mailboxes_per_day;
	const percent = () =>
		Math.min(100, Math.round((used() / Math.max(1, limit())) * 100));

	const revoke = async (id: string) => {
		setFailure("");
		try {
			await revokeSession(id);
			props.onChange();
		} catch (error) {
			setFailure(
				error instanceof Error ? error.message : "Something went wrong.",
			);
		}
	};
	const leave = async () => {
		await signOut();
		props.onChange();
	};

	return (
		<>
			<div {...stylex.attrs(styles.identity)}>
				<img
					src={`https://github.com/${encodeURIComponent(props.account.user.github_login)}.png?size=112`}
					alt=""
					width="56"
					height="56"
					{...stylex.attrs(styles.avatar)}
				/>
				<div {...stylex.attrs(styles.who)}>
					<h1 {...stylex.attrs(styles.login)}>
						{props.account.user.github_login}
					</h1>
					<p {...stylex.attrs(styles.email)}>
						{props.account.user.email ??
							"Email not available yet — it is saved on your next sign-in."}
					</p>
				</div>
				<button
					type="button"
					onClick={() => void leave()}
					{...stylex.attrs(styles.textButton)}
				>
					Sign out
				</button>
			</div>

			<section {...stylex.attrs(styles.section)}>
				<h2 {...stylex.attrs(styles.sectionTitle)}>Usage</h2>
				<div {...stylex.attrs(styles.usageRow)}>
					<div {...stylex.attrs(styles.usageHead)}>
						<span {...stylex.attrs(styles.label)}>Mailboxes today</span>
						<span {...stylex.attrs(styles.value)}>
							{used()} of {limit()}
						</span>
					</div>
					<div {...stylex.attrs(styles.bar)}>
						<div
							{...stylex.attrs(styles.barFill)}
							style={{ width: `${percent()}%` }}
						/>
					</div>
				</div>
				<div {...stylex.attrs(styles.row)}>
					<span {...stylex.attrs(styles.label)}>Plan</span>
					<span {...stylex.attrs(styles.value)}>
						{props.account.plan.charAt(0).toUpperCase() +
							props.account.plan.slice(1)}
					</span>
				</div>
				<div {...stylex.attrs(styles.row)}>
					<span {...stylex.attrs(styles.label)}>Quota resets</span>
					<span {...stylex.attrs(styles.value)}>
						{resetsIn(props.account.quota.resets_at)}
					</span>
				</div>
			</section>

			<section {...stylex.attrs(styles.section)}>
				<h2 {...stylex.attrs(styles.sectionTitle)}>Signed-in apps</h2>
				<Show
					when={props.account.sessions.length > 0}
					fallback={
						<p {...stylex.attrs(styles.empty)}>
							None yet. Paste the setup sentence from the home page into Claude
							Code or Codex.
						</p>
					}
				>
					<ul {...stylex.attrs(styles.list)}>
						<For each={props.account.sessions}>
							{(session) => (
								<li {...stylex.attrs(styles.row)}>
									<span {...stylex.attrs(styles.app)}>
										<span {...stylex.attrs(styles.appName)}>
											{session.client_name}
										</span>
										<br />
										<span {...stylex.attrs(styles.appMeta)}>
											Signed in {dateTime(session.signed_in_at)}
										</span>
									</span>
									<button
										type="button"
										aria-label={`Revoke ${session.client_name}`}
										onClick={() => void revoke(session.id)}
										{...stylex.attrs(styles.textButton)}
									>
										Revoke
									</button>
								</li>
							)}
						</For>
					</ul>
				</Show>
				<Show when={failure()}>
					{(message) => (
						<p role="alert" {...stylex.attrs(styles.error)}>
							{message()}
						</p>
					)}
				</Show>
			</section>
		</>
	);
}

export default function AccountPage() {
	usePageHead({
		title: "Account — smails",
		description: "Your smails account, usage and signed-in apps.",
		noindex: true,
	});
	const { data: account, reload } = useClientData(getAccount);

	return (
		<div {...stylex.attrs(styles.page)}>
			<Loading fallback={<p {...stylex.attrs(styles.muted)}>Loading…</p>}>
				<Switch>
					<Match when={account().state === "loading"}>
						<p {...stylex.attrs(styles.muted)}>Loading…</p>
					</Match>
					<Match when={account().state === "error"}>
						<div {...stylex.attrs(styles.center)}>
							<h1 {...stylex.attrs(styles.centerTitle)}>Sign in to smails</h1>
							<p {...stylex.attrs(styles.centerText)}>
								See your usage and the apps signed in to your account.
							</p>
							<ButtonLink rel="external" href={signInHref("/account")}>
								Continue with GitHub
							</ButtonLink>
						</div>
					</Match>
					<Match when={account().state === "ok" && account()}>
						{(loaded) => {
							const value = () => {
								const current = loaded();
								return current.state === "ok" ? current.value : null;
							};
							return (
								<Show when={value()}>
									{(data) => <AccountView account={data()} onChange={reload} />}
								</Show>
							);
						}}
					</Match>
				</Switch>
			</Loading>
		</div>
	);
}
