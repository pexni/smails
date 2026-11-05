import { Article, H2, Link, List, P } from "#/components/prose.tsx";
import { CodeBlock } from "#/ui/Code.tsx";
import { usePageHead } from "#/utils/head.ts";

export default function Otp() {
	usePageHead({
		title:
			"Receive verification codes (OTP) and magic links with an AI agent — smails",
		description:
			"Let an AI agent finish sign-ups on its own: it creates a disposable inbox, enters the address, waits for the one-time code or magic link and reads it. MCP, CLI or HTTP.",
	});
	return (
		<Article
			docs
			title="Verification codes and magic links, handled by your agent"
			lead="Sign-up flows stop at “check your email”. With smails the agent has an inbox of its own, so it can read the code and keep going."
		>
			<H2>The flow</H2>
			<List>
				<li>Create a mailbox and use the address in the sign-up form.</li>
				<li>
					Wait for the email — one call that returns as soon as it arrives.
				</li>
				<li>Read the code or the link from the body and continue.</li>
			</List>

			<H2>From an MCP client</H2>
			<P>
				Connect <Link href="/docs/mcp">the MCP server</Link>, then ask your
				agent something like: “Sign up for the newsletter at example.com with a
				smails address and confirm it.” It will call create_mailbox, fill in the
				form, call wait_for_message and open the confirmation link.
			</P>

			<H2>From a script</H2>
			<CodeBlock
				label="terminal"
				code={`ADDRESS=$(smails create)
# … submit $ADDRESS to the sign-up form …
smails wait --subject code --json | jq -r .text | grep -oE '\\b[0-9]{6}\\b' | head -1`}
			/>

			<H2>Good to know</H2>
			<List>
				<li>Receive-only: smails cannot send mail.</li>
				<li>
					Some sites block disposable domains. smails cannot work around that.
				</li>
				<li>Use it for accounts you control and testing your own flows.</li>
			</List>
		</Article>
	);
}
