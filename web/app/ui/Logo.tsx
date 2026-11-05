import * as stylex from "@stylexjs/stylex";

import { color, font, space, text } from "./tokens.stylex.ts";

const styles = stylex.create({
	wrap: {
		display: "inline-flex",
		alignItems: "center",
		gap: space.sm,
		color: color.text,
		fontFamily: font.mono,
		fontSize: text.lg,
		fontWeight: 700,
		letterSpacing: "-0.03em",
		textDecoration: "none",
	},
	mark: { flexShrink: 0 },
});

/** 标志：荧光绿圆角方块，里面是信封的轮廓和一个终端光标。和 public/favicon.svg 是同一个图形。 */
export function LogoMark(props: { size?: number }) {
	const size = () => props.size ?? 24;
	return (
		<svg
			width={size()}
			height={size()}
			viewBox="0 0 32 32"
			aria-hidden="true"
			{...stylex.attrs(styles.mark)}
		>
			<rect width="32" height="32" rx="8" fill="#b4f461" />
			<path
				d="M7.5 11.5h17v10.5h-17z"
				fill="none"
				stroke="#0b0c0d"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<path
				d="M7.5 11.5 16 17.5l8.5-6"
				fill="none"
				stroke="#0b0c0d"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<rect x="21" y="19" width="5" height="2.5" rx="0.5" fill="#0b0c0d" />
		</svg>
	);
}

export function Logo(props: { href?: string }) {
	return (
		<a
			href={props.href ?? "/"}
			aria-label="smails home"
			{...stylex.attrs(styles.wrap)}
		>
			<LogoMark />
			<span>smails</span>
		</a>
	);
}
