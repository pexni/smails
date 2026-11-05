import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { omit } from "solid-js";

import { color, font, radius, space, text } from "./tokens.stylex.ts";

const styles = stylex.create({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: space.sm,
		minHeight: "2.75rem",
		paddingInline: space.xl,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "transparent",
		borderRadius: radius.full,
		fontFamily: font.sans,
		fontSize: text.md,
		fontWeight: 600,
		lineHeight: 1.25,
		textDecoration: "none",
		whiteSpace: "nowrap",
		cursor: { default: "pointer", ":disabled": "default" },
		transitionDuration: "120ms",
		transitionProperty: "background-color, border-color, color, opacity",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
		outlineOffset: "2px",
	},
	// 一屏只放一个。悬停只是略微变淡：换成灰色会像被禁用。
	solid: {
		backgroundColor: color.text,
		color: color.bg,
		opacity: { default: 1, ":hover": 0.86, ":disabled": 0.45 },
	},
	outline: {
		backgroundColor: "transparent",
		color: color.text,
		borderColor: { default: color.borderStrong, ":hover": color.text },
		opacity: { default: 1, ":disabled": 0.45 },
	},
	danger: {
		backgroundColor: "transparent",
		color: color.danger,
		borderColor: color.danger,
		opacity: { default: 1, ":hover": 0.8, ":disabled": 0.45 },
	},
	small: { minHeight: "2rem", paddingInline: space.md, fontSize: text.sm },
});

type Variant = "solid" | "outline" | "danger";

export function Button(
	props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: Variant;
		small?: boolean;
	},
) {
	const rest = omit(props, "variant", "small");
	return (
		<button
			type="button"
			{...rest}
			{...stylex.attrs(
				styles.base,
				styles[props.variant ?? "solid"],
				props.small && styles.small,
			)}
		/>
	);
}

export function ButtonLink(
	props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
		variant?: Variant;
		small?: boolean;
	},
) {
	const rest = omit(props, "variant", "small");
	return (
		<a
			{...rest}
			{...stylex.attrs(
				styles.base,
				styles[props.variant ?? "solid"],
				props.small && styles.small,
			)}
		/>
	);
}
