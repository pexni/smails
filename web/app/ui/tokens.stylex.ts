import * as stylex from "@stylexjs/stylex";

// 设计变量。组件只引用这里的变量，不写死颜色、间距、圆角。
// 视觉基调：纯黑白极简，深色为主（系统是浅色模式时反过来）。没有彩色：
// 层次靠字号、字重、留白和明暗对比。只有出错提示用红色，那是功能色。

const LIGHT = "@media (prefers-color-scheme: light)";

export const color = stylex.defineVars({
	bg: { default: "#0a0a0a", [LIGHT]: "#ffffff" },
	// 卡片、代码块。
	surface: { default: "#111111", [LIGHT]: "#fafafa" },
	// 卡片里再抬起来一层（终端标题栏、标签页）。
	raised: { default: "#1a1a1a", [LIGHT]: "#f2f2f2" },
	border: { default: "#262626", [LIGHT]: "#eaeaea" },
	borderStrong: { default: "#3a3a3a", [LIGHT]: "#d4d4d4" },
	text: { default: "#ededed", [LIGHT]: "#0a0a0a" },
	muted: { default: "#a1a1a1", [LIGHT]: "#525252" },
	// 最弱的文字；在 bg 和 surface 上都有 4.5:1。
	subtle: { default: "#8f8f8f", [LIGHT]: "#6b6b6b" },
	// “强调”就是最强的明暗对比：深色模式下是白，浅色模式下是黑。
	accent: { default: "#ededed", [LIGHT]: "#0a0a0a" },
	accentText: { default: "#ffffff", [LIGHT]: "#000000" },
	onAccent: { default: "#0a0a0a", [LIGHT]: "#ffffff" },
	accentSoft: {
		default: "rgb(255 255 255 / 0.08)",
		[LIGHT]: "rgb(0 0 0 / 0.05)",
	},
	// 背景网格的线和 hero 后面的微光（都是中性色）。
	grid: { default: "rgb(255 255 255 / 0.04)", [LIGHT]: "rgb(0 0 0 / 0.045)" },
	glow: { default: "rgb(255 255 255 / 0.07)", [LIGHT]: "rgb(0 0 0 / 0.04)" },
	danger: { default: "#f87171", [LIGHT]: "#b91c1c" },
	success: { default: "#ededed", [LIGHT]: "#0a0a0a" },
	// 终端里的颜色：提示符用弱色，工具名用正文色加粗。
	termPrompt: { default: "#8f8f8f", [LIGHT]: "#6b6b6b" },
	termTool: { default: "#ededed", [LIGHT]: "#0a0a0a" },
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
	sans: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
	mono: '"Geist Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
});

export const layout = stylex.defineVars({
	// 正文栏的宽度：一行六七十个字母。
	content: "46rem",
	wide: "72rem",
});
