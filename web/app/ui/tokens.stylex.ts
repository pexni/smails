import * as stylex from "@stylexjs/stylex";

// 设计变量。组件只引用这里的变量，不写死颜色、间距、圆角。
// 视觉基调：开发者工具风，深色为主（系统是浅色模式时切到浅色）。
// 一个荧光绿强调色，只用在关键信息上：验证码、状态点、焦点环、主按钮的光。

const LIGHT = "@media (prefers-color-scheme: light)";

export const color = stylex.defineVars({
	bg: { default: "#08090a", [LIGHT]: "#fbfbfa" },
	// 卡片、代码块。
	surface: { default: "#101113", [LIGHT]: "#ffffff" },
	// 卡片里再抬起来一层（终端标题栏、标签页）。
	raised: { default: "#16181b", [LIGHT]: "#f3f3f1" },
	border: { default: "#1f2226", [LIGHT]: "#e6e6e3" },
	borderStrong: { default: "#2e3238", [LIGHT]: "#cfcfca" },
	text: { default: "#f4f5f6", [LIGHT]: "#0b0c0d" },
	muted: { default: "#a1a5ab", [LIGHT]: "#55585d" },
	// 最弱的文字；在 bg 和 surface 上都有 4.5:1。
	subtle: { default: "#7e838a", [LIGHT]: "#6a6d72" },
	// 强调色：填充用 accent，强调色的文字用 accentText（浅色模式下要更深才有对比度）。
	accent: { default: "#b4f461", [LIGHT]: "#65a30d" },
	accentText: { default: "#c5f78a", [LIGHT]: "#3f6212" },
	onAccent: "#0b0c0d",
	accentSoft: {
		default: "rgb(180 244 97 / 0.12)",
		[LIGHT]: "rgb(101 163 13 / 0.12)",
	},
	// 背景网格的线和 hero 后面的光。
	grid: { default: "rgb(255 255 255 / 0.045)", [LIGHT]: "rgb(0 0 0 / 0.05)" },
	glow: {
		default: "rgb(180 244 97 / 0.16)",
		[LIGHT]: "rgb(101 163 13 / 0.14)",
	},
	danger: { default: "#f87171", [LIGHT]: "#b91c1c" },
	success: { default: "#b4f461", [LIGHT]: "#3f6212" },
	// 终端里的颜色。
	termPrompt: { default: "#7dd3fc", [LIGHT]: "#0369a1" },
	termTool: { default: "#c4b5fd", [LIGHT]: "#6d28d9" },
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
	"5xl": "112px",
});

export const radius = stylex.defineVars({
	sm: "6px",
	md: "10px",
	lg: "14px",
	xl: "20px",
	full: "999px",
});

export const text = stylex.defineVars({
	xs: "0.75rem",
	sm: "0.875rem",
	md: "1rem",
	lg: "1.125rem",
	xl: "1.5rem",
	"2xl": "clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem)",
	"3xl": "clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)",
});

export const font = stylex.defineVars({
	sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	mono: 'ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
});

export const layout = stylex.defineVars({
	// 正文栏的宽度：一行六七十个字母。
	content: "46rem",
	wide: "72rem",
});
