import { useLocation } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import { Logo } from "#/ui/Logo.tsx";
import { color, font, layout, space, text } from "#/ui/tokens.stylex.ts";

// 顶部只有两个入口：Docs（文档内部的目录在文档页的侧栏里，不在这里重复）和 Account。

const FOOTER_LINKS = [
	{ href: "/privacy", label: "Privacy" },
	{ href: "https://github.com/pexni/smails", label: "GitHub" },
	{ href: "https://smail.pw", label: "smail.pw" },
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
		fontFeatureSettings: '"ss01", "cv11"',
	},
	header: {
		position: "sticky",
		top: 0,
		zIndex: 10,
		backgroundColor: `color-mix(in srgb, ${color.bg} 82%, transparent)`,
		backdropFilter: "saturate(1.4) blur(12px)",
	},
	headerInner: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		maxWidth: layout.wide,
		height: "4rem",
		marginInline: "auto",
		paddingInline: space.xl,
	},
	nav: { display: "flex", alignItems: "center", gap: space.xl },
	navLink: {
		color: { default: color.muted, ":hover": color.text },
		fontSize: text.sm,
		textDecoration: "none",
		transitionProperty: "color",
		transitionDuration: "120ms",
	},
	navActive: { color: color.text },
	main: { flexGrow: 1, width: "100%", minWidth: 0 },
	footer: {
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: space.lg,
		width: "100%",
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingBlock: space["2xl"],
		paddingInline: space.xl,
		color: color.subtle,
		fontSize: text.sm,
	},
	footerLinks: { display: "flex", flexWrap: "wrap", gap: space.xl },
	footerLink: {
		color: { default: color.subtle, ":hover": color.text },
		textDecoration: "none",
	},
});

export function Layout(props: ParentProps) {
	const location = useLocation();
	const inDocs = () =>
		location.pathname.startsWith("/docs") || location.pathname === "/otp";
	const inAccount = () => location.pathname === "/account";

	return (
		<div {...stylex.attrs(styles.shell)}>
			<header {...stylex.attrs(styles.header)}>
				<div {...stylex.attrs(styles.headerInner)}>
					<Logo />
					<nav aria-label="Main" {...stylex.attrs(styles.nav)}>
						<a
							href="/docs/mcp"
							{...stylex.attrs(styles.navLink, inDocs() && styles.navActive)}
						>
							Docs
						</a>
						<a
							href="/account"
							{...stylex.attrs(styles.navLink, inAccount() && styles.navActive)}
						>
							Account
						</a>
					</nav>
				</div>
			</header>
			<main {...stylex.attrs(styles.main)}>{props.children}</main>
			<footer {...stylex.attrs(styles.footer)}>
				<span>smails — email inboxes for AI agents</span>
				<span {...stylex.attrs(styles.footerLinks)}>
					{FOOTER_LINKS.map((link) => (
						<a href={link.href} {...stylex.attrs(styles.footerLink)}>
							{link.label}
						</a>
					))}
				</span>
			</footer>
		</div>
	);
}
