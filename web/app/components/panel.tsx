import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import { color, font, radius, space, text } from "#/ui/tokens.stylex.ts";

// 登录相关的几个页面（Device Login、授权确认、账号）：页面中间一张卡片。

const styles = stylex.create({
	wrap: {
		display: "flex",
		justifyContent: "center",
		paddingTop: space["4xl"],
		paddingBottom: space["4xl"],
		paddingInline: space.xl,
	},
	panel: {
		width: "100%",
		maxWidth: "28rem",
		paddingBlock: space["2xl"],
		paddingInline: space["2xl"],
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.xl,
		backgroundColor: color.surface,
		boxShadow: "0 30px 80px -40px rgb(0 0 0 / 0.5)",
	},
	title: { marginBlock: `0 ${space.md}`, fontSize: text.xl, lineHeight: 1.25 },
	text: { marginBlock: space.md, color: color.muted },
	code: {
		marginBlock: space.lg,
		paddingBlock: space.lg,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.md,
		backgroundColor: color.raised,
		color: color.accentText,
		fontFamily: font.mono,
		fontSize: text["2xl"],
		fontWeight: 700,
		letterSpacing: "0.12em",
		textAlign: "center",
	},
	actions: {
		display: "flex",
		flexWrap: "wrap",
		gap: space.md,
		marginTop: space.xl,
	},
	error: { marginBlock: space.md, color: color.danger },
	strong: { color: color.text, fontWeight: 600 },
});

export function Panel(props: ParentProps<{ title: string }>) {
	return (
		<div {...stylex.attrs(styles.wrap)}>
			<section {...stylex.attrs(styles.panel)}>
				<h1 {...stylex.attrs(styles.title)}>{props.title}</h1>
				{props.children}
			</section>
		</div>
	);
}

export const PanelText = (props: ParentProps) => (
	<p {...stylex.attrs(styles.text)}>{props.children}</p>
);
export const PanelError = (props: ParentProps) => (
	<p role="alert" {...stylex.attrs(styles.error)}>
		{props.children}
	</p>
);
export const Actions = (props: ParentProps) => (
	<div {...stylex.attrs(styles.actions)}>{props.children}</div>
);
export const BigCode = (props: { children: string }) => (
	<div aria-label="Code" {...stylex.attrs(styles.code)}>
		{props.children}
	</div>
);
export const Strong = (props: ParentProps) => (
	<strong {...stylex.attrs(styles.strong)}>{props.children}</strong>
);
