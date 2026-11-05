import { bindings, defineConfig, exports, triggers } from "cf/config";

// 域名、Worker 名、数据库和存储桶都写在仓库根目录的 site.config.ts 里。
import { site } from "../site.config.ts";
// 用带 cf-worker 属性的导入而不是路径字符串：这样 ctx.exports 能按入口实际导出的类推出类型。
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	// 没有 staging 环境：上线前用本地开发服务器（真实的 workerd）加真实的 MCP 客户端测试。
	worker: {
		name: site.worker,
		entrypoint,
		compatibilityDate: "2026-11-01",
		triggers: [
			triggers.fetch({ pattern: `${site.domain}/*`, zone: site.domain }),
		],
		// 静态文件是前端的构建产物（../web/dist/client），由 vite.config.ts 的 publicDir 带进来。
		// 页面都由静态资源直接返回；只有下面这些路径才进 Worker。
		assets: {
			notFoundHandling: "404-page",
			runWorkerFirst: [
				"/api/*",
				"/mcp",
				"/.well-known/*",
				"/authorize",
				"/token",
				"/register",
				"/revoke",
				"/device/code",
				"/oauth/*",
				// 只在本地开发时有处理（/__dev/login），线上 Worker 对它回答 404。
				"/__dev/*",
			],
		},
		observability: {
			// 只写 enabled: false 时，每次调用仍会记一条调用日志（invocationLogs 默认开），要单独关。
			logs: { enabled: false, invocationLogs: false },
			traces: { enabled: false },
			issues: { enabled: true },
		},
		env: {
			// 本站域名：生成地址、拼 OAuth 的 issuer 和资源地址都用它。
			SITE_DOMAIN: bindings.text(site.domain),
			// 用户、OAuth 客户端、令牌、邮箱、配额。迁移文件在 migrations/core/。
			CORE: bindings.d1({
				name: site.databases.core.name,
				...(site.databases.core.id ? { id: site.databases.core.id } : {}),
			}),
			// 邮件元数据，只增不删。迁移文件在 migrations/mail/。
			MAIL: bindings.d1({
				name: site.databases.mail.name,
				...(site.databases.mail.id ? { id: site.databases.mail.id } : {}),
			}),
			// 邮件原文，对象 key 是邮件 id。
			R2: bindings.r2({ name: site.bucket }),
			// GitHub OAuth App：只用来确认用户是谁。
			GITHUB_CLIENT_ID: bindings.secret(),
			GITHUB_CLIENT_SECRET: bindings.secret(),
			// 访问令牌的签名密钥，逗号分隔可轮换：最左边的签名，其余只用来验证。
			TOKEN_SECRETS: bindings.secret(),
			// 网页会话 cookie 的签名密钥，同上。
			SESSION_SECRETS: bindings.secret(),
			// 邮箱地址校验码的密钥。换掉它，之前发出去的地址就都收不到信了。
			ADDR_SECRET: bindings.secret(),
		},
		exports: {
			// 新邮件推送：全站共用一个，见 src/inbox-hub.ts。
			InboxHub: exports.durableObject({ storage: "sqlite" }),
			// 旧版每个邮箱一个的 DO。只剩 alarm 清理数据，旧数据清空后改成 state: "deleted"。
			Mailbox: exports.durableObject({ storage: "sqlite" }),
		},
	},
});
