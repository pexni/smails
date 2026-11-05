import * as stylex from "@stylexjs/stylex";
import { createSignal, createUniqueId, For } from "solid-js";

import { color, font, radius, space, text } from "#/ui/tokens.stylex.ts";

export type CodeTab = {
	id: string;
	label: string;
	caption: string;
	code: string;
};

const styles = stylex.create({
	frame: {
		overflow: "hidden",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.lg,
		backgroundColor: color.surface,
	},
	tabs: {
		display: "flex",
		gap: space.xs,
		paddingBlock: space.sm,
		paddingInline: space.sm,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: color.border,
		backgroundColor: color.raised,
		overflowX: "auto",
	},
	tab: {
		paddingBlock: space.xs,
		paddingInline: space.md,
		borderWidth: 0,
		borderRadius: radius.sm,
		backgroundColor: "transparent",
		color: { default: color.subtle, ":hover": color.text },
		fontFamily: font.sans,
		fontSize: text.sm,
		fontWeight: 500,
		whiteSpace: "nowrap",
		cursor: "pointer",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
	},
	active: { backgroundColor: color.surface, color: color.text },
	panel: { paddingBlock: space.lg, paddingInline: space.lg },
	caption: {
		margin: `0 0 ${space.md}`,
		color: color.subtle,
		fontSize: text.sm,
	},
	pre: {
		margin: 0,
		overflowX: "auto",
		color: color.text,
		fontFamily: font.mono,
		fontSize: text.sm,
		lineHeight: 1.7,
	},
	footer: { display: "flex", justifyContent: "flex-end", marginTop: space.md },
	copy: {
		paddingBlock: "2px",
		paddingInline: space.sm,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: color.border,
		borderRadius: radius.sm,
		backgroundColor: "transparent",
		color: { default: color.subtle, ":hover": color.text },
		fontFamily: font.sans,
		fontSize: text.xs,
		cursor: "pointer",
		outline: { default: "none", ":focus-visible": `2px solid ${color.accent}` },
	},
});

/** 几段代码之间切换（WAI-ARIA tabs：左右方向键切换，Home/End 到头尾）。 */
export function CodeTabs(props: { tabs: CodeTab[] }) {
	const id = createUniqueId();
	const [selected, setSelected] = createSignal(0);
	const [copied, setCopied] = createSignal(false);
	const current = () => props.tabs.at(selected()) ?? props.tabs[0]!;

	const focusTab = (index: number) => {
		const count = props.tabs.length;
		const next = (index + count) % count;
		setSelected(next);
		document.getElementById(`${id}-tab-${next}`)?.focus();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		const keys: Record<string, number> = {
			ArrowRight: selected() + 1,
			ArrowLeft: selected() - 1,
			Home: 0,
			End: props.tabs.length - 1,
		};
		const target = keys[event.key];
		if (target !== undefined) {
			event.preventDefault();
			focusTab(target);
		}
	};
	const copy = async () => {
		await navigator.clipboard.writeText(current().code);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div {...stylex.attrs(styles.frame)}>
			<div
				role="tablist"
				aria-label="Ways to connect"
				onKeyDown={onKeyDown}
				{...stylex.attrs(styles.tabs)}
			>
				<For each={props.tabs}>
					{(tab, index) => (
						<button
							type="button"
							role="tab"
							id={`${id}-tab-${index()}`}
							aria-selected={selected() === index() ? "true" : "false"}
							aria-controls={`${id}-panel`}
							tabindex={selected() === index() ? 0 : -1}
							onClick={() => setSelected(index())}
							{...stylex.attrs(
								styles.tab,
								selected() === index() && styles.active,
							)}
						>
							{tab.label}
						</button>
					)}
				</For>
			</div>
			<div
				role="tabpanel"
				id={`${id}-panel`}
				aria-labelledby={`${id}-tab-${selected()}`}
				{...stylex.attrs(styles.panel)}
			>
				<p {...stylex.attrs(styles.caption)}>{current().caption}</p>
				<pre {...stylex.attrs(styles.pre)}>
					<code>{current().code}</code>
				</pre>
				<div {...stylex.attrs(styles.footer)}>
					<button
						type="button"
						onClick={() => void copy()}
						{...stylex.attrs(styles.copy)}
					>
						{copied() ? "Copied" : "Copy"}
					</button>
				</div>
			</div>
		</div>
	);
}
