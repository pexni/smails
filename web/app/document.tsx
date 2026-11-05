import { HydrationScript } from "@solidjs/web";
import type { ParentProps } from "solid-js";
import { Show } from "solid-js";

export default function Document(props: ParentProps) {
	return (
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" sizes="48x48" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				<link
					rel="preload"
					href="/fonts/Geist-Variable.woff2"
					as="font"
					type="font/woff2"
					crossorigin="anonymous"
				/>
				<meta
					name="theme-color"
					content="#0a0a0a"
					media="(prefers-color-scheme: dark)"
				/>
				<meta
					name="theme-color"
					content="#ffffff"
					media="(prefers-color-scheme: light)"
				/>
				{/* 没有 index.html，StyleX 插件注入不了开发样式表，这里自己接。 */}
				<Show when={import.meta.env.DEV}>
					<link rel="stylesheet" href="/virtual:stylex.css" />
					<script type="module" src="/@id/virtual:stylex:runtime" />
				</Show>
				<HydrationScript />
			</head>
			<body>{props.children}</body>
		</html>
	);
}
