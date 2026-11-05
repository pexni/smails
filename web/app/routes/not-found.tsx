import { Article, Link, P } from "#/components/prose.tsx";
import { usePageHead } from "#/utils/head.ts";

export default function NotFound() {
	usePageHead({
		title: "Not found — smails",
		description: "This page does not exist.",
		noindex: true,
	});
	return (
		<Article title="Page not found">
			<P>
				Try the <Link href="/">home page</Link> or the{" "}
				<Link href="/docs/mcp">MCP docs</Link>.
			</P>
		</Article>
	);
}
