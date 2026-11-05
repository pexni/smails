import type { PrerenderIntegration } from "prerender-crawler";

/**
 * 生成 404.html：访问不存在的地址时，静态资源服务直接返回它（状态码 404），不经过 Worker。
 * 一个不带应用脚本的独立小页面（照搬 smail.pw 的做法）。
 */
export function notFoundPage(siteName: string): PrerenderIntegration {
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 | ${siteName}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{color-scheme:light dark}
body{display:grid;min-height:100dvh;margin:0;place-content:center;justify-items:center;gap:1rem;background:#fff;color:#0b0b0c;font-family:system-ui,-apple-system,sans-serif}
h1{margin:0;font-size:3rem;letter-spacing:-0.04em}
a{color:inherit}
@media (prefers-color-scheme:dark){body{background:#0b0b0c;color:#f5f5f4}}
</style>
</head>
<body>
<h1>404</h1>
<a href="/">${siteName}</a>
</body>
</html>
`;
	return {
		name: "not-found-page",
		teardown(context) {
			context.emitFile({ filename: "404.html", contents: html });
		},
	};
}
