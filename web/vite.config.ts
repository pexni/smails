import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { sitemap } from "prerender-crawler";
import { prerender } from "prerender-crawler/vite";
import { defineConfig } from "vite";

import { site } from "../site.config.ts";

// 这个项目只产出静态网站（dist/client）。接口、OAuth、MCP 和收信在 ../worker 里，
// 部署时 Worker 把这里的产物当静态文件带上。
export default defineConfig({
	server: {
		port: 5174,
		strictPort: true,
		// 本地开发时这些路径由 ../worker 的开发服务器提供（8792）。
		proxy: Object.fromEntries(
			[
				"/api",
				"/mcp",
				"/.well-known",
				"/authorize",
				"/token",
				"/register",
				"/revoke",
				"/device/code",
				"/oauth",
				"/__dev",
			].map((prefix) => [prefix, { target: "http://localhost:8792" }]),
		),
	},
	plugins: [
		// StyleX 必须在 Solid 转换 JSX 之前编译。
		stylex.vite({
			useCSSLayers: true,
			// StyleX 自己解析 *.stylex.ts 的导入，不读 package.json 的 imports，
			// 所以把 #/ 这个路径别名再告诉它一遍。
			aliases: {
				"#/*": [fileURLToPath(new URL("./app/*", import.meta.url))],
			},
		}),
		solid({
			ssr: true,
			diagnostics: true,
			start: {
				app: "app/app.tsx",
				document: "app/document.tsx",
				// 只在构建和本地开发时运行，见文件里的说明。
				middleware: "./app/middleware.ts",
				// 不要开 renderMode: "async"：smail 实测这个模式下并发渲染会串页面的 <head>。
			},
		}),
		// 构建完成后在 Node 里把每个页面渲染成 HTML 写进 dist/client。
		prerender({
			mode: "static",
			// /mcp 写成 mcp.html。
			autoSubfolderIndex: false,
			integrations: [
				sitemap({ hostname: `https://${site.domain}` }),
				{
					// 构建清单只在构建时有用，不该作为静态文件发布出去。
					name: "drop-build-manifest",
					teardown(context) {
						rmSync(path.join(context.outDir, ".vite"), {
							recursive: true,
							force: true,
						});
					},
				},
			],
		}),
	],
});
