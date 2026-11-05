import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import {
	color,
	font,
	layout,
	radius,
	space,
	text,
} from "#/ui/tokens.stylex.ts";

// 文档页的排版：标题、段落、列表。正文栏不超过 44rem，一行六七十个字母。

const DOCS = [
	{ href: "/docs/mcp", label: "MCP server" },
	{ href: "/docs/cli", label: "CLI" },
	{ href: "/docs/api", label: "HTTP API" },
];

const styles = stylex.create({
	page: {
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingInline: space.xl,
		paddingBottom: space["4xl"],
	},
	article: { maxWidth: layout.content, paddingTop: space["3xl"] },
	docsNav: {
		display: "flex",
		gap: space.xs,
		marginBottom: space["2xl"],
		paddingBottom: space.md,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		overflowX: "auto",
	},
	docsLink: {
		paddingBlock: space.xs,
		paddingInline: space.md,
		borderRadius: radius.full,
		color: {
			default: color.subtle,
			":hover": color.text,
			":is([aria-current=page])": color.text,
		},
		backgroundColor: {
			default: "transparent",
			":is([aria-current=page])": color.raised,
		},
		fontSize: text.sm,
		fontWeight: 500,
		textDecoration: "none",
		whiteSpace: "nowrap",
	},
	eyebrow: {
		margin: 0,
		color: color.accentText,
		fontFamily: font.mono,
		fontSize: text.sm,
		fontWeight: 600,
		letterSpacing: "0.04em",
		textTransform: "uppercase",
	},
	h1: {
		marginBlock: `${space.sm} ${space.lg}`,
		fontSize: text["2xl"],
		lineHeight: 1.1,
		letterSpacing: "-0.035em",
		textWrap: "balance",
	},
	lead: {
		marginBlock: `0 ${space["2xl"]}`,
		color: color.muted,
		fontSize: text.lg,
	},
	h2: {
		marginBlock: `${space["3xl"]} ${space.md}`,
		fontSize: text.xl,
		lineHeight: 1.25,
		letterSpacing: "-0.01em",
	},
	h3: {
		marginBlock: `${space.xl} ${space.sm}`,
		fontSize: text.lg,
		lineHeight: 1.3,
	},
	p: { marginBlock: space.md },
	list: { marginBlock: space.md, paddingInlineStart: space.xl },
	link: { color: color.accent, textUnderlineOffset: "3px" },
	note: {
		marginBlock: space.lg,
		paddingBlock: space.md,
		paddingInline: space.lg,
		borderLeftWidth: "3px",
		borderLeftStyle: "solid",
		borderLeftColor: color.borderStrong,
		color: color.muted,
	},
});

export function Article(
	props: ParentProps<{
		eyebrow?: string;
		title: string;
		lead?: string;
		docs?: boolean;
	}>,
) {
	return (
		<div {...stylex.attrs(styles.page)}>
			<article {...stylex.attrs(styles.article)}>
				{props.docs ? (
					<nav aria-label="Docs" {...stylex.attrs(styles.docsNav)}>
						{DOCS.map((item) => (
							<a href={item.href} {...stylex.attrs(styles.docsLink)}>
								{item.label}
							</a>
						))}
					</nav>
				) : null}
				{props.eyebrow ? (
					<p {...stylex.attrs(styles.eyebrow)}>{props.eyebrow}</p>
				) : null}
				<h1 {...stylex.attrs(styles.h1)}>{props.title}</h1>
				{props.lead ? <p {...stylex.attrs(styles.lead)}>{props.lead}</p> : null}
				{props.children}
			</article>
		</div>
	);
}

export const H2 = (props: ParentProps<{ id?: string }>) => (
	<h2 id={props.id} {...stylex.attrs(styles.h2)}>
		{props.children}
	</h2>
);
export const H3 = (props: ParentProps) => (
	<h3 {...stylex.attrs(styles.h3)}>{props.children}</h3>
);
export const P = (props: ParentProps) => (
	<p {...stylex.attrs(styles.p)}>{props.children}</p>
);
export const List = (props: ParentProps) => (
	<ul {...stylex.attrs(styles.list)}>{props.children}</ul>
);
export const Note = (props: ParentProps) => (
	<p {...stylex.attrs(styles.note)}>{props.children}</p>
);
export const Link = (props: ParentProps<{ href: string }>) => (
	<a href={props.href} {...stylex.attrs(styles.link)}>
		{props.children}
	</a>
);
