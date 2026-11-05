import * as stylex from "@stylexjs/stylex";

import { color, space } from "#/ui/tokens.stylex.ts";

export default function Home() {
	return (
		<section {...stylex.attrs(styles.page)}>
			<h1>smails</h1>
			<p>Disposable email for AI agents.</p>
		</section>
	);
}

const styles = stylex.create({
	page: {
		color: color.text,
		backgroundColor: color.bg,
		padding: space.lg,
	},
});
