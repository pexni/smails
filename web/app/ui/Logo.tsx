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
		fontWeight: 600,
		letterSpacing: "-0.04em",
		textDecoration: "none",
	},
	mark: { flexShrink: 0 },
});

/**
 * 标志：圆角方框里一个左下角的实心三角，抽象地表示信封的折角。单色，跟着文字颜色走
 * （深色模式下是白，浅色模式下是黑）。public/favicon.svg 是同一个图形。
 */
export function LogoMark(props: { size?: number }) {
	const size = () => props.size ?? 22;
	return (
		<svg
			width={size()}
			height={size()}
			viewBox="0 0 32 32"
			aria-hidden="true"
			{...stylex.attrs(styles.mark)}
		>
			<rect
				x="2"
				y="2"
				width="28"
				height="28"
				rx="7"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			/>
			<path d="M9 9v14h14z" fill="currentColor" />
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
