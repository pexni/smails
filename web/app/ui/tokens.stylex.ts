import * as stylex from "@stylexjs/stylex";

// 设计变量。组件只引用这里的变量，不写死颜色、间距、圆角。
// 具体的视觉在第 4 阶段定，这里先放骨架。

const DARK = "@media (prefers-color-scheme: dark)";

export const color = stylex.defineVars({
	bg: { default: "#faf9f6", [DARK]: "#0e0e0d" },
	text: { default: "#16150f", [DARK]: "#f2f1ec" },
	muted: { default: "#5f5d55", [DARK]: "#a8a69c" },
});

export const space = stylex.defineVars({
	sm: "8px",
	md: "16px",
	lg: "24px",
});
