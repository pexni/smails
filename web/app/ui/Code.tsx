import * as stylex from "@stylexjs/stylex";
import { createSignal } from "solid-js";

import { color, font, radius, space, text } from "./tokens.stylex.ts";

const styles = stylex.create({
	block: {
		position: "relative",
		maxWidth: "100%",
		minWidth: 0,
		marginBlock: space.lg,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.lg,
		backgroundColor: color.surface,
	},
	label: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.md,
		paddingBlock: space.sm,
		paddingInline: space.lg,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		backgroundColor: color.raised,
		color: color.subtle,
		fontFamily: font.mono,
		fontSize: text.xs,
	},
	pre: {
		margin: 0,
		paddingBlock: space.lg,
		paddingInline: space.lg,
		overflowX: "auto",
		fontFamily: font.mono,
		fontSize: text.sm,
		lineHeight: 1.6,
		color: color.text,
		whiteSpace: "pre",
	},
	copy: {
		paddingBlock: "2px",
		paddingInline: space.sm,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.sm,
		backgroundColor: "transparent",
		color: color.muted,
		fontFamily: font.sans,
		fontSize: text.xs,
		cursor: "pointer",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
	},
	inline: {
		paddingInline: "0.3em",
		paddingBlock: "0.1em",
		borderRadius: radius.sm,
		backgroundColor: color.surface,
		fontFamily: font.mono,
		fontSize: "0.9em",
		overflowWrap: "anywhere",
	},
});

/** 一段可以复制的代码。label 写在左上角（比如 "terminal"、"mcp.json"）。 */
export function CodeBlock(props: { code: string; label?: string }) {
	const [copied, setCopied] = createSignal(false);
	const copy = async () => {
		await navigator.clipboard.writeText(props.code);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};
	return (
		<div {...stylex.attrs(styles.block)}>
			<div {...stylex.attrs(styles.label)}>
				<span>{props.label ?? ""}</span>
				<button
					type="button"
					onClick={() => void copy()}
					{...stylex.attrs(styles.copy)}
				>
					{copied() ? "Copied" : "Copy"}
				</button>
			</div>
			<pre {...stylex.attrs(styles.pre)}>
				<code>{props.code}</code>
			</pre>
		</div>
	);
}

export function InlineCode(props: { children: string }) {
	return <code {...stylex.attrs(styles.inline)}>{props.children}</code>;
}
