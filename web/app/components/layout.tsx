import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import { color, font, layout, space, text } from "#/ui/tokens.stylex.ts";

const NAV = [
	{ href: "/docs/mcp", label: "MCP" },
	{ href: "/docs/cli", label: "CLI" },
	{ href: "/docs/api", label: "API" },
	{ href: "/account", label: "Account" },
];

const styles = stylex.create({
	shell: {
		minHeight: "100dvh",
		display: "flex",
		flexDirection: "column",
		backgroundColor: color.bg,
		color: color.text,
		fontFamily: font.sans,
		fontSize: text.md,
		lineHeight: 1.6,
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.lg,
		width: "100%",
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingBlock: space.lg,
		paddingInline: space.xl,
	},
	brand: {
		color: color.text,
		fontFamily: font.mono,
		fontSize: text.lg,
		fontWeight: 700,
		textDecoration: "none",
		letterSpacing: "-0.02em",
	},
	nav: {
		display: "flex",
		gap: { default: space.lg, "@media (max-width: 30rem)": space.md },
	},
	// 当前页面的链接（路由会给它加上 aria-current="page"）用正文颜色。
	navLink: {
		color: {
			default: color.muted,
			":hover": color.text,
			":is([aria-current=page])": color.text,
		},
		fontSize: text.sm,
		textDecoration: "none",
	},
	main: {
		flexGrow: 1,
		minWidth: 0,
		width: "100%",
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingInline: space.xl,
		paddingBottom: space["4xl"],
	},
	footer: {
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: color.border,
		color: color.subtle,
		fontSize: text.sm,
	},
	footerInner: {
		display: "flex",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: space.lg,
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingBlock: space.xl,
		paddingInline: space.xl,
	},
	footerLinks: { display: "flex", flexWrap: "wrap", gap: space.lg },
	footerLink: { color: { default: color.subtle, ":hover": color.text } },
});

export function Layout(props: ParentProps) {
	return (
		<div {...stylex.attrs(styles.shell)}>
			<header {...stylex.attrs(styles.header)}>
				<a href="/" {...stylex.attrs(styles.brand)}>
					smails
				</a>
				<nav {...stylex.attrs(styles.nav)}>
					{NAV.map((item) => (
						<a href={item.href} {...stylex.attrs(styles.navLink)}>
							{item.label}
						</a>
					))}
				</nav>
			</header>
			<main {...stylex.attrs(styles.main)}>{props.children}</main>
			<footer {...stylex.attrs(styles.footer)}>
				<div {...stylex.attrs(styles.footerInner)}>
					<span>Disposable email for AI agents.</span>
					<span {...stylex.attrs(styles.footerLinks)}>
						<a href="https://smail.pw" {...stylex.attrs(styles.footerLink)}>
							Need an inbox yourself? smail.pw
						</a>
						<a href="/privacy" {...stylex.attrs(styles.footerLink)}>
							Privacy
						</a>
						<a
							href="https://github.com/pexni/smails"
							{...stylex.attrs(styles.footerLink)}
						>
							GitHub
						</a>
					</span>
				</div>
			</footer>
		</div>
	);
}
