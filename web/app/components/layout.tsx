import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import { ButtonLink } from "#/ui/Button.tsx";
import { Logo } from "#/ui/Logo.tsx";
import { color, font, layout, space, text } from "#/ui/tokens.stylex.ts";

const NAV = [
	{ href: "/docs/mcp", label: "MCP" },
	{ href: "/docs/cli", label: "CLI" },
	{ href: "/docs/api", label: "API" },
];

const FOOTER = [
	{
		title: "Product",
		links: [
			{ href: "/docs/mcp", label: "MCP server" },
			{ href: "/docs/cli", label: "CLI" },
			{ href: "/docs/api", label: "HTTP API" },
			{ href: "/otp", label: "Verification codes" },
		],
	},
	{
		title: "Account",
		links: [
			{ href: "/account", label: "Account" },
			{ href: "/privacy", label: "Privacy" },
		],
	},
	{
		title: "More",
		links: [
			{ href: "https://github.com/pexni/smails", label: "GitHub" },
			{ href: "https://www.npmjs.com/package/@smails/cli", label: "npm" },
			{ href: "https://smail.pw", label: "smail.pw — inbox for people" },
		],
	},
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
		position: "sticky",
		top: 0,
		zIndex: 10,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		backgroundColor: `color-mix(in srgb, ${color.bg} 78%, transparent)`,
		backdropFilter: "saturate(1.4) blur(12px)",
	},
	headerInner: {
		display: "flex",
		alignItems: "center",
		gap: space.xl,
		maxWidth: layout.wide,
		height: "3.75rem",
		marginInline: "auto",
		paddingInline: space.xl,
	},
	nav: {
		display: "flex",
		flexGrow: 1,
		gap: { default: space.lg, "@media (min-width: 40rem)": space.xl },
	},
	navLink: {
		color: {
			default: color.muted,
			":hover": color.text,
			":is([aria-current=page])": color.text,
		},
		fontSize: text.sm,
		fontWeight: 500,
		textDecoration: "none",
		transitionProperty: "color",
		transitionDuration: "120ms",
	},
	main: { flexGrow: 1, width: "100%", minWidth: 0 },
	footer: {
		borderTopWidth: "1px",
		borderTopStyle: "solid",
		borderTopColor: color.border,
		color: color.subtle,
		fontSize: text.sm,
	},
	footerInner: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 48rem)": "1.4fr repeat(3, minmax(0, 1fr))",
		},
		gap: space["2xl"],
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingBlock: space["3xl"],
		paddingInline: space.xl,
	},
	tagline: { marginBlock: `${space.md} 0`, maxWidth: "18rem" },
	columnTitle: {
		marginBlock: `0 ${space.md}`,
		color: color.text,
		fontSize: text.sm,
		fontWeight: 600,
	},
	links: {
		display: "grid",
		gap: space.sm,
		margin: 0,
		padding: 0,
		listStyle: "none",
	},
	link: {
		color: { default: color.subtle, ":hover": color.text },
		textDecoration: "none",
	},
	signIn: {
		display: { default: "none", "@media (min-width: 30rem)": "inline-flex" },
	},
});

export function Layout(props: ParentProps) {
	return (
		<div {...stylex.attrs(styles.shell)}>
			<header {...stylex.attrs(styles.header)}>
				<div {...stylex.attrs(styles.headerInner)}>
					<Logo />
					<nav aria-label="Main" {...stylex.attrs(styles.nav)}>
						{NAV.map((item) => (
							<a href={item.href} {...stylex.attrs(styles.navLink)}>
								{item.label}
							</a>
						))}
					</nav>
					<span {...stylex.attrs(styles.signIn)}>
						<ButtonLink href="/account" variant="outline" small>
							Account
						</ButtonLink>
					</span>
				</div>
			</header>
			<main {...stylex.attrs(styles.main)}>{props.children}</main>
			<footer {...stylex.attrs(styles.footer)}>
				<div {...stylex.attrs(styles.footerInner)}>
					<div>
						<Logo />
						<p {...stylex.attrs(styles.tagline)}>
							Disposable email inboxes for AI agents. Receive-only, free to
							start.
						</p>
					</div>
					{FOOTER.map((column) => (
						<div>
							<p {...stylex.attrs(styles.columnTitle)}>{column.title}</p>
							<ul {...stylex.attrs(styles.links)}>
								{column.links.map((link) => (
									<li>
										<a href={link.href} {...stylex.attrs(styles.link)}>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</footer>
		</div>
	);
}
