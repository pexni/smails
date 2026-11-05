import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import { color, font, layout, space, text } from "#/ui/tokens.stylex.ts";

// 文档页的排版：标题、段落、列表。正文栏不超过 44rem，一行六七十个字母。

// 文档目录：只在文档页的侧栏里出现一次（顶部导航只有一个 Docs 入口）。
const DOCS = [
	{ href: "/docs/mcp", label: "MCP server" },
	{ href: "/docs/cli", label: "CLI" },
	{ href: "/docs/api", label: "HTTP API" },
	{ href: "/otp", label: "Verification codes" },
];

const styles = stylex.create({
	page: {
		maxWidth: layout.wide,
		marginInline: "auto",
		paddingInline: space.xl,
		paddingBottom: space["4xl"],
	},
	// 文档页：左边目录，右边正文。窄屏时目录收成正文上方的一行。
	docsGrid: {
		display: "grid",
		gridTemplateColumns: {
			default: "minmax(0, 1fr)",
			"@media (min-width: 56rem)": "11rem minmax(0, 1fr)",
		},
		gap: { default: 0, "@media (min-width: 56rem)": space["4xl"] },
	},
	sidebar: {
		position: { default: "static", "@media (min-width: 56rem)": "sticky" },
		top: "5.5rem",
		alignSelf: "start",
		paddingTop: {
			default: space.xl,
			"@media (min-width: 56rem)": space["3xl"],
		},
	},
	sideList: {
		display: "flex",
		flexDirection: { default: "row", "@media (min-width: 56rem)": "column" },
		gap: { default: space.lg, "@media (min-width: 56rem)": space.sm },
		margin: 0,
		padding: 0,
		listStyle: "none",
		overflowX: "auto",
		borderBottomWidth: { default: "1px", "@media (min-width: 56rem)": 0 },
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		paddingBottom: { default: space.md, "@media (min-width: 56rem)": 0 },
	},
	sideLink: {
		color: {
			default: color.subtle,
			":hover": color.text,
			":is([aria-current=page])": color.text,
		},
		fontSize: text.sm,
		textDecoration: "none",
		whiteSpace: "nowrap",
	},
	article: { maxWidth: layout.content, paddingTop: space["3xl"] },
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
	const body = (
		<article {...stylex.attrs(styles.article)}>
			{props.eyebrow ? (
				<p {...stylex.attrs(styles.eyebrow)}>{props.eyebrow}</p>
			) : null}
			<h1 {...stylex.attrs(styles.h1)}>{props.title}</h1>
			{props.lead ? <p {...stylex.attrs(styles.lead)}>{props.lead}</p> : null}
			{props.children}
		</article>
	);
	return (
		<div {...stylex.attrs(styles.page)}>
			{props.docs ? (
				<div {...stylex.attrs(styles.docsGrid)}>
					<nav aria-label="Docs" {...stylex.attrs(styles.sidebar)}>
						<ul {...stylex.attrs(styles.sideList)}>
							{DOCS.map((item) => (
								<li>
									<a href={item.href} {...stylex.attrs(styles.sideLink)}>
										{item.label}
									</a>
								</li>
							))}
						</ul>
					</nav>
					{body}
				</div>
			) : (
				body
			)}
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
