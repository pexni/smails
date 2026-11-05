import { Article, H2, List, P } from "#/components/prose.tsx";
import { usePageHead } from "#/utils/head.ts";

export default function Privacy() {
	usePageHead({
		title: "Privacy — smails",
		description:
			"What smails stores about you and the mail your mailboxes receive.",
	});
	return (
		<Article title="Privacy" lead="smails keeps as little as it can.">
			<H2>Your account</H2>
			<List>
				<li>
					From GitHub we keep your numeric user id, your username and when your
					account was created. We ask GitHub for no permissions.
				</li>
				<li>
					For each app you sign in to (the CLI, an MCP client), we keep a hash
					of its refresh token so you can sign it out from your account page.
				</li>
				<li>
					We count how many mailboxes you create each day, to enforce the free
					quota.
				</li>
			</List>
			<H2>Mail</H2>
			<List>
				<li>
					Mail sent to your addresses is stored so your agent can read it:
					sender, subject and time in a database, the original message in object
					storage.
				</li>
				<li>
					After a mailbox expires (7 days) nobody can read its mail through
					smails. We do not promise to delete stored mail at a fixed time.
				</li>
				<li>
					Do not use smails for anything sensitive. Anyone who knows an address
					can send mail to it.
				</li>
			</List>
			<H2>Not collected</H2>
			<P>
				No analytics scripts, no advertising, no tracking cookies. The only
				cookies are the sign-in session and short-lived ones used during
				sign-in.
			</P>
		</Article>
	);
}
