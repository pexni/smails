import { handleApi } from "./api.ts";
import { migrateLocally } from "./dev-migrate.ts";
import { errorResponse, HttpError, json } from "./http.ts";
import { receiveEmail } from "./mail.ts";
import { handleMcp } from "./mcp.ts";
import { handleIdentity } from "./oauth/index.ts";
import { originOf } from "./tokens.ts";
import { HUB_NAME } from "./wait.ts";

export { InboxHub } from "./inbox-hub.ts";
export { Mailbox } from "./legacy.ts";

// 浏览器直接打开的地址：出错时显示一个小页面，而不是一段 JSON。
const BROWSER_PATHS = new Set([
	"/authorize",
	"/oauth/github/start",
	"/oauth/github/callback",
]);

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				char
			] ?? char,
	);
}

function errorPage(error: HttpError): Response {
	const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>smails — sign-in problem</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem"><h1 style="font-size:1.25rem">Something went wrong</h1><p>${escapeHtml(error.message)}</p><p><a href="/">Back to smails</a></p></body></html>`;
	return new Response(body, {
		status: error.status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"Content-Security-Policy":
				"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
		},
	});
}

async function route(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const { pathname } = new URL(request.url);
	const origin = originOf(request, env.SITE_DOMAIN);

	if (pathname === "/mcp") {
		return handleMcp(request, env, ctx, origin);
	}
	const identity = await handleIdentity(request, env, origin);
	if (identity) {
		return identity;
	}
	if (pathname.startsWith("/api/") && !pathname.startsWith("/api/web/")) {
		return handleApi(request, env, ctx);
	}
	throw new HttpError(404, "not_found", "No such endpoint.");
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		try {
			if (import.meta.env.DEV) {
				await migrateLocally(env);
			}
			return await route(request, env, ctx);
		} catch (error) {
			if (error instanceof HttpError) {
				return BROWSER_PATHS.has(new URL(request.url).pathname)
					? errorPage(error)
					: errorResponse(error);
			}
			console.error(error);
			return json({ error: "internal", message: "Internal error." }, 500);
		}
	},

	async email(message, env, ctx): Promise<void> {
		if (import.meta.env.DEV) {
			await migrateLocally(env);
		}
		await receiveEmail(message, env, (address) =>
			ctx.exports.InboxHub.getByName(HUB_NAME).notify(address),
		);
	},
} satisfies ExportedHandler<Env>;
