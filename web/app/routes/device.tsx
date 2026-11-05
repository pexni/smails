import { useNavigate, useSearchParams } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import {
	createMemo,
	createSignal,
	Loading,
	Match,
	Show,
	Switch,
} from "solid-js";

import {
	decideDevice,
	getDeviceRequest,
	getSession,
	signInHref,
} from "#/api.ts";
import {
	Actions,
	BigCode,
	Panel,
	PanelError,
	PanelText,
	Strong,
} from "#/components/panel.tsx";
import { Button, ButtonLink } from "#/ui/Button.tsx";
import { color, font, radius, space, text } from "#/ui/tokens.stylex.ts";
import { useClientData } from "#/utils/client-data.ts";
import { usePageHead } from "#/utils/head.ts";

// Device Login 的确认页：CLI 或本地 MCP 给出 /device?code=XXXX-XXXX，用户打开后用 GitHub 登录、
// 核对代码、点“确认”。打开链接本身不算授权：一定要点确认，并且页面上醒目地显示代码让用户核对。

const styles = stylex.create({
	form: { display: "flex", gap: space.md, marginTop: space.lg },
	input: {
		flexGrow: 1,
		minWidth: 0,
		minHeight: "2.75rem",
		paddingInline: space.md,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.borderStrong,
		borderRadius: radius.md,
		backgroundColor: color.bg,
		color: color.text,
		fontFamily: font.mono,
		fontSize: text.lg,
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
	},
});

type Outcome = "approved" | "denied" | null;

export default function Device() {
	usePageHead({
		title: "Confirm sign-in — smails",
		description: "Confirm a smails CLI or MCP sign-in.",
		noindex: true,
	});
	const [search] = useSearchParams();
	const navigate = useNavigate();
	const code = () => (typeof search.code === "string" ? search.code : "");
	const here = () =>
		code() ? `/device?code=${encodeURIComponent(code())}` : "/device";

	const session = useClientData(getSession).data;
	const signedIn = createMemo(() => {
		const s = session();
		return s.state === "ok" ? s.value.user : null;
	});
	const request = useClientData(async () => {
		if (!code() || !signedIn()) {
			return null;
		}
		return getDeviceRequest(code());
	}).data;

	const clientName = createMemo(() => {
		const r = request();
		return r.state === "ok" && r.value ? r.value.client_name : "smails";
	});

	const [outcome, setOutcome] = createSignal<Outcome>(null);
	const [busy, setBusy] = createSignal(false);
	const [failure, setFailure] = createSignal("");
	const decide = async (approve: boolean) => {
		setBusy(true);
		setFailure("");
		try {
			await decideDevice(code(), approve);
			setOutcome(approve ? "approved" : "denied");
		} catch (error) {
			setFailure(
				error instanceof Error ? error.message : "Something went wrong.",
			);
		} finally {
			setBusy(false);
		}
	};

	const [typed, setTyped] = createSignal("");
	const submitCode = (event: SubmitEvent) => {
		event.preventDefault();
		navigate(
			`/device?code=${encodeURIComponent(typed().trim().toUpperCase())}`,
		);
	};

	return (
		<Loading
			fallback={
				<Panel title="Confirm sign-in">
					<PanelText>Loading…</PanelText>
				</Panel>
			}
		>
			<Switch>
				<Match when={outcome() === "approved"}>
					<Panel title="You're signed in">
						<PanelText>
							Return to your terminal or agent — it will continue on its own.
						</PanelText>
					</Panel>
				</Match>
				<Match when={outcome() === "denied"}>
					<Panel title="Sign-in cancelled">
						<PanelText>
							Nothing was signed in. You can close this tab.
						</PanelText>
					</Panel>
				</Match>
				<Match when={session().state === "loading"}>
					<Panel title="Confirm sign-in">
						<PanelText>Loading…</PanelText>
					</Panel>
				</Match>
				<Match when={!signedIn()}>
					<Panel title="Sign in to smails">
						<PanelText>
							The smails CLI (or an agent using it) wants to sign in to your
							account. Continue with GitHub, then confirm the code.
						</PanelText>
						<Show when={code()}>{(value) => <BigCode>{value()}</BigCode>}</Show>
						<Actions>
							<ButtonLink href={signInHref(here())}>
								Continue with GitHub
							</ButtonLink>
						</Actions>
					</Panel>
				</Match>
				<Match when={!code()}>
					<Panel title="Enter your code">
						<PanelText>Type the code shown by `smails login`.</PanelText>
						<form onSubmit={submitCode} {...stylex.attrs(styles.form)}>
							<input
								name="code"
								autocomplete="one-time-code"
								placeholder="XXXX-XXXX"
								aria-label="Code"
								value={typed()}
								onInput={(event) => setTyped(event.currentTarget.value)}
								{...stylex.attrs(styles.input)}
							/>
							<Button type="submit">Continue</Button>
						</form>
					</Panel>
				</Match>
				<Match when={request().state === "error"}>
					<Panel title="Code not valid">
						<PanelText>
							This code is invalid or has expired. Run{" "}
							<Strong>smails login</Strong> again to get a new one.
						</PanelText>
					</Panel>
				</Match>
				<Match when={request().state === "ok"}>
					<Panel title="Confirm sign-in">
						<PanelText>
							Make sure this code matches the one in your terminal or agent.
							Only confirm if you started this sign-in.
						</PanelText>
						<BigCode>{code().toUpperCase()}</BigCode>
						<PanelText>
							Signing in as <Strong>{signedIn()?.github_login ?? ""}</Strong> to{" "}
							<Strong>{clientName()}</Strong>.
						</PanelText>
						<Show when={failure()}>
							{(message) => <PanelError>{message()}</PanelError>}
						</Show>
						<Actions>
							<Button disabled={busy()} onClick={() => void decide(true)}>
								Confirm
							</Button>
							<Button
								variant="outline"
								disabled={busy()}
								onClick={() => void decide(false)}
							>
								Cancel
							</Button>
						</Actions>
					</Panel>
				</Match>
			</Switch>
		</Loading>
	);
}
