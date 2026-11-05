import * as stylex from "@stylexjs/stylex";
import { createSignal, For, Loading, Match, Show, Switch } from "solid-js";

import { getAccount, revokeSession, signInHref, signOut } from "#/api.ts";
import {
	Actions,
	Panel,
	PanelError,
	PanelText,
	Strong,
} from "#/components/panel.tsx";
import { Button, ButtonLink } from "#/ui/Button.tsx";
import { color, space, text } from "#/ui/tokens.stylex.ts";
import { useClientData } from "#/utils/client-data.ts";
import { usePageHead } from "#/utils/head.ts";

const styles = stylex.create({
	list: { margin: 0, padding: 0, listStyle: "none" },
	item: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		paddingBlock: space.md,
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: color.border,
	},
	meta: { color: color.subtle, fontSize: text.sm },
	heading: { marginBlock: `${space.xl} ${space.sm}`, fontSize: text.md },
});

export default function AccountPage() {
	usePageHead({
		title: "Account — smails",
		description: "Your smails account, quota and signed-in apps.",
		noindex: true,
	});
	const { data: account, reload } = useClientData(getAccount);
	const [failure, setFailure] = createSignal("");

	const revoke = async (id: string) => {
		setFailure("");
		try {
			await revokeSession(id);
			reload();
		} catch (error) {
			setFailure(
				error instanceof Error ? error.message : "Something went wrong.",
			);
		}
	};
	const leave = async () => {
		await signOut();
		reload();
	};

	return (
		<Loading
			fallback={
				<Panel title="Account">
					<PanelText>Loading…</PanelText>
				</Panel>
			}
		>
			<Switch>
				<Match when={account().state === "loading"}>
					<Panel title="Account">
						<PanelText>Loading…</PanelText>
					</Panel>
				</Match>
				<Match when={account().state === "error"}>
					<Panel title="Sign in">
						<PanelText>
							Sign in with GitHub to see your quota and the apps signed in to
							your account.
						</PanelText>
						<Actions>
							<ButtonLink href={signInHref("/account")}>
								Continue with GitHub
							</ButtonLink>
						</Actions>
					</Panel>
				</Match>
				<Match when={account().state === "ok" && account()}>
					{(loaded) => {
						const value = () => {
							const current = loaded();
							return current.state === "ok" ? current.value : null;
						};
						return (
							<Panel title="Account">
								<PanelText>
									Signed in as{" "}
									<Strong>{value()?.user.github_login ?? ""}</Strong> · plan{" "}
									<Strong>{value()?.plan ?? ""}</Strong>
								</PanelText>
								<PanelText>
									Mailboxes today:{" "}
									<Strong>
										{value()?.quota.mailboxes_today ?? 0} /{" "}
										{value()?.quota.mailboxes_per_day ?? 0}
									</Strong>
								</PanelText>
								<h2 {...stylex.attrs(styles.heading)}>Signed-in apps</h2>
								<Show
									when={(value()?.sessions.length ?? 0) > 0}
									fallback={
										<PanelText>
											None yet. Run `smails login` or connect an MCP client.
										</PanelText>
									}
								>
									<ul {...stylex.attrs(styles.list)}>
										<For each={value()?.sessions ?? []}>
											{(session) => (
												<li {...stylex.attrs(styles.item)}>
													<span>
														{session.client_name}
														<br />
														<span {...stylex.attrs(styles.meta)}>
															since{" "}
															{new Date(
																session.signed_in_at,
															).toLocaleDateString()}
														</span>
													</span>
													<Button
														variant="danger"
														small
														onClick={() => void revoke(session.id)}
													>
														Sign out
													</Button>
												</li>
											)}
										</For>
									</ul>
								</Show>
								<Show when={failure()}>
									{(message) => <PanelError>{message()}</PanelError>}
								</Show>
								<Actions>
									<Button variant="outline" onClick={() => void leave()}>
										Sign out of this browser
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
