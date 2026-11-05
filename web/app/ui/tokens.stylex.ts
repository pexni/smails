import * as stylex from "@stylexjs/stylex";

// 设计变量。组件只引用这里的变量，不写死颜色、间距、圆角。
// 视觉基调：黑白为主，像一份终端里的说明书；只有一个强调色，用在链接和焦点环上。

const DARK = "@media (prefers-color-scheme: dark)";

export const color = stylex.defineVars({
	bg: { default: "#ffffff", [DARK]: "#0b0b0c" },
	// 代码块、卡片这类稍微抬起来的底。
	surface: { default: "#f5f5f4", [DARK]: "#161617" },
	border: { default: "#e7e5e4", [DARK]: "#2a2a2c" },
	borderStrong: { default: "#c9c7c4", [DARK]: "#3f3f42" },
	text: { default: "#0b0b0c", [DARK]: "#f5f5f4" },
	muted: { default: "#57534e", [DARK]: "#a8a29e" },
	// 最弱的文字，在 bg 上仍有 4.5:1。
	subtle: { default: "#6b6762", [DARK]: "#8f8a84" },
	accent: { default: "#2563eb", [DARK]: "#60a5fa" },
	danger: { default: "#b91c1c", [DARK]: "#f87171" },
	success: { default: "#15803d", [DARK]: "#4ade80" },
});

export const space = stylex.defineVars({
	xs: "4px",
	sm: "8px",
	md: "12px",
	lg: "16px",
	xl: "24px",
	"2xl": "32px",
	"3xl": "48px",
	"4xl": "72px",
});

export const radius = stylex.defineVars({
	sm: "6px",
	md: "10px",
	lg: "14px",
	full: "999px",
});

export const text = stylex.defineVars({
	xs: "0.75rem",
	sm: "0.875rem",
	md: "1rem",
	lg: "1.125rem",
	xl: "1.5rem",
	"2xl": "2.25rem",
	"3xl": "clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)",
});

export const font = stylex.defineVars({
	sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
});

export const layout = stylex.defineVars({
	// 正文栏的宽度：一行六七十个字母。
	content: "44rem",
	wide: "64rem",
});
