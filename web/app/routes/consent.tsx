import {
	createMemo,
	createSignal,
	Loading,
	Match,
	Show,
	Switch,
} from "solid-js";

import {
	decideAuthorization,
	getPendingAuthorization,
	getSession,
	signInHref,
} from "#/api.ts";
import {
	Actions,
	Panel,
	PanelError,
	PanelText,
	Strong,
} from "#/components/panel.tsx";
import { Button, ButtonLink } from "#/ui/Button.tsx";
import { useClientData } from "#/utils/client-data.ts";
import { usePageHead } from "#/utils/head.ts";

// OAuth 授权确认页：远程 MCP 客户端（Claude、Cursor……）发起 /authorize 后来到这里。
// 页面醒目地显示客户端名字和它要跳回的主机，用户据此判断是不是自己在用的那个客户端。
// 所有客户端共用我们一个 GitHub 应用，所以这一页不能省：不然恶意客户端能借着用户已登录的状态悄悄拿到令牌。

export default function Consent() {
	usePageHead({
		title: "Authorize access — smails",
		description: "Allow an MCP client to use your smails account.",
		noindex: true,
	});
	const pending = useClientData(getPendingAuthorization).data;
	const session = useClientData(getSession).data;
	const user = createMemo(() => {
		const s = session();
		return s.state === "ok" ? s.value.user : null;
	});
	const [busy, setBusy] = createSignal(false);
	const [failure, setFailure] = createSignal("");

	const decide = async (approve: boolean) => {
		setBusy(true);
		setFailure("");
		try {
			const { redirect } = await decideAuthorization(approve);
			window.location.assign(redirect);
		} catch (error) {
			setFailure(
				error instanceof Error ? error.message : "Something went wrong.",
			);
			setBusy(false);
		}
	};

	const loadingPanel = (
		<Panel title="Authorize access">
			<PanelText>Loading…</PanelText>
		</Panel>
	);

	return (
		<Loading fallback={loadingPanel}>
			<Switch>
				<Match
					when={pending().state === "loading" || session().state === "loading"}
				>
					{loadingPanel}
				</Match>
				<Match when={pending().state === "error"}>
					<Panel title="Request expired">
						<PanelText>
							This authorization request has expired or was already used. Go
							back to your app and connect smails again.
						</PanelText>
					</Panel>
				</Match>
				<Match when={!user()}>
					<Panel title="Sign in to smails">
						<PanelText>
							An app wants to connect to your smails account. Sign in first.
						</PanelText>
						<Actions>
							<ButtonLink rel="external" href={signInHref("/consent")}>
								Continue with GitHub
							</ButtonLink>
						</Actions>
					</Panel>
				</Match>
				<Match when={pending().state === "ok" && pending()}>
					{(loaded) => {
						const request = () => {
							const value = loaded();
							return value.state === "ok" ? value.value : null;
						};
						return (
							<Panel title="Authorize access">
								<PanelText>
									<Strong>{request()?.client_name ?? ""}</Strong> wants to use
									your smails account (
									<Strong>{user()?.github_login ?? ""}</Strong>) to create
									mailboxes and read the mail they receive.
								</PanelText>
								<PanelText>
									After you allow it, you'll be sent back to{" "}
									<Strong>{request()?.redirect_host ?? ""}</Strong>. Only
									continue if that's the app you're setting up.
								</PanelText>
								<Show when={failure()}>
									{(message) => <PanelError>{message()}</PanelError>}
								</Show>
								<Actions>
									<Button disabled={busy()} onClick={() => void decide(true)}>
										Allow
									</Button>
									<Button
										variant="outline"
										disabled={busy()}
										onClick={() => void decide(false)}
									>
										Deny
									</Button>
								</Actions>
							</Panel>
						);
					}}
				</Match>
			</Switch>
		</Loading>
	);
}
