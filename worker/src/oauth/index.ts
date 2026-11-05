import type { OAuthPending, WebSession } from "../contract.ts";
import {
	finishGitHubLogin,
	safeNext,
	startGitHubLogin,
	upsertUser,
} from "../github.ts";
import { assertSameOrigin, HttpError, json, readJson } from "../http.ts";
import {
	clearSessionCookie,
	readSession,
	sessionCookie,
	type WebUser,
} from "../session.ts";
import {
	approveAuthorization,
	clearPendingCookie,
	denyAuthorization,
	readPending,
	startAuthorization,
} from "./authorize.ts";
import { registerClient, resolveClient } from "./clients.ts";
import {
	decideDeviceRequest,
	describeDeviceRequest,
	startDeviceAuthorization,
} from "./device.ts";
import { OAuthError, oauthErrorResponse } from "./errors.ts";
import { revokeRefreshToken } from "./grants.ts";
import {
	authorizationServerMetadata,
	protectedResourceMetadata,
} from "./metadata.ts";
import { handleToken } from "./token.ts";

// 不带 cookie 的 OAuth 端点和元数据允许跨域：浏览器里跑的 MCP 客户端（比如 MCP Inspector）要直接调。
// 带 cookie 的网页接口（/api/web/*）不在此列。
const CORS_PATHS = new Set([
	"/.well-known/oauth-protected-resource",
	"/.well-known/oauth-protected-resource/mcp",
	"/.well-known/oauth-protected-resource/api",
	"/.well-known/oauth-authorization-server",
	"/token",
	"/register",
	"/revoke",
	"/device/code",
]);

export function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	headers.set(
		"Access-Control-Allow-Headers",
		"Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
	);
	headers.set(
		"Access-Control-Expose-Headers",
		"WWW-Authenticate, Mcp-Session-Id",
	);
	headers.set("Access-Control-Max-Age", "86400");
	return new Response(response.body, { status: response.status, headers });
}

async function readForm(request: Request): Promise<URLSearchParams> {
	const type = request.headers.get("Content-Type") ?? "";
	if (type.includes("application/x-www-form-urlencoded")) {
		return new URLSearchParams(await request.text());
	}
	// 有的客户端发 JSON；照样接受。
	if (type.includes("application/json")) {
		const body = await readJson(request);
		return new URLSearchParams(
			Object.entries(body)
				.filter(([, value]) => typeof value === "string")
				.map(([key, value]) => [key, value as string]),
		);
	}
	throw new OAuthError(400, "invalid_request", "Send the request as a form.");
}

async function requireWebUser(request: Request, env: Env): Promise<WebUser> {
	const user = await readSession(request, env);
	if (!user) {
		throw new HttpError(401, "unauthorized", "Sign in with GitHub first.");
	}
	return user;
}

/** OAuth 端点：没有 cookie，错误是 OAuth 的格式。 */
async function oauthEndpoint(
	request: Request,
	env: Env,
	origin: string,
	pathname: string,
): Promise<Response | null> {
	const method = request.method;
	if (
		method === "GET" &&
		pathname === "/.well-known/oauth-authorization-server"
	) {
		return json(authorizationServerMetadata(origin));
	}
	if (
		method === "GET" &&
		pathname === "/.well-known/oauth-protected-resource/mcp"
	) {
		return json(protectedResourceMetadata(origin, "mcp"));
	}
	if (
		method === "GET" &&
		(pathname === "/.well-known/oauth-protected-resource" ||
			pathname === "/.well-known/oauth-protected-resource/api")
	) {
		return json(protectedResourceMetadata(origin, "api"));
	}
	if (method === "POST" && pathname === "/token") {
		return json(await handleToken(env, await readForm(request), origin));
	}
	if (method === "POST" && pathname === "/device/code") {
		return json(
			await startDeviceAuthorization(env, await readForm(request), origin),
		);
	}
	if (method === "POST" && pathname === "/register") {
		return json(await registerClient(env, await readJson(request)), 201);
	}
	if (method === "POST" && pathname === "/revoke") {
		const token = (await readForm(request)).get("token");
		if (token) {
			await revokeRefreshToken(env, token);
		}
		return new Response(null, { status: 200 });
	}
	return null;
}

/** 网页接口：认 cookie 会话，改动状态的请求都要同源。 */
async function webEndpoint(
	request: Request,
	env: Env,
	origin: string,
	pathname: string,
): Promise<Response | null> {
	const method = request.method;
	const url = new URL(request.url);

	if (method === "GET" && pathname === "/api/web/session") {
		const user = await readSession(request, env);
		const body: WebSession = { user };
		return json(body);
	}
	if (method === "POST" && pathname === "/api/web/logout") {
		assertSameOrigin(request);
		return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
	}

	if (method === "GET" && pathname === "/api/web/oauth/pending") {
		const pending = await readPending(request, env);
		const client = await resolveClient(env, pending.cid);
		const body: OAuthPending = {
			client_name: client.name,
			redirect_host: new URL(pending.ru).host || new URL(pending.ru).protocol,
			scope: pending.sc,
		};
		return json(body);
	}
	if (method === "POST" && pathname === "/api/web/oauth/consent") {
		assertSameOrigin(request);
		const user = await requireWebUser(request, env);
		const pending = await readPending(request, env);
		const { approve } = await readJson(request);
		const redirect =
			approve === true
				? await approveAuthorization(env, pending, user.id, origin)
				: denyAuthorization(pending, origin);
		return json({ redirect }, 200, { "Set-Cookie": clearPendingCookie() });
	}

	if (method === "GET" && pathname === "/api/web/device") {
		await requireWebUser(request, env);
		return json(
			await describeDeviceRequest(env, url.searchParams.get("code") ?? ""),
		);
	}
	if (method === "POST" && pathname === "/api/web/device") {
		assertSameOrigin(request);
		const user = await requireWebUser(request, env);
		const { user_code: code, approve } = await readJson(request);
		if (typeof code !== "string") {
			throw new HttpError(400, "invalid_request", "user_code is required.");
		}
		await decideDeviceRequest(env, code, user.id, approve === true);
		return json({ ok: true });
	}
	return null;
}

/** 本地开发专用：不经过 GitHub 直接登录一个测试用户。生产构建里整段不存在。 */
async function devLogin(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const login =
		(url.searchParams.get("login") ?? "dev").replace(/[^A-Za-z0-9-]/g, "") ||
		"dev";
	let githubId = 0;
	for (const char of login) {
		githubId = (githubId * 31 + char.charCodeAt(0)) % 2_000_000_000;
	}
	const user = await upsertUser(env, {
		id: githubId + 1,
		login,
		created_at: "2015-01-01T00:00:00Z",
	});
	return new Response(null, {
		status: 302,
		headers: {
			Location: safeNext(url.searchParams.get("next")),
			"Set-Cookie": await sessionCookie(env, user),
		},
	});
}

/** OAuth、GitHub 登录和网页接口。不归这里管的路径返回 null。 */
export async function handleIdentity(
	request: Request,
	env: Env,
	origin: string,
): Promise<Response | null> {
	const { pathname } = new URL(request.url);

	if (CORS_PATHS.has(pathname)) {
		if (request.method === "OPTIONS") {
			return withCors(new Response(null, { status: 204 }));
		}
		try {
			const response = await oauthEndpoint(request, env, origin, pathname);
			return response ? withCors(response) : null;
		} catch (error) {
			if (error instanceof OAuthError) {
				return withCors(oauthErrorResponse(error));
			}
			throw error;
		}
	}

	if (request.method === "GET" && pathname === "/authorize") {
		return startAuthorization(request, env, origin);
	}
	if (request.method === "GET" && pathname === "/oauth/github/start") {
		return startGitHubLogin(request, env, origin);
	}
	if (request.method === "GET" && pathname === "/oauth/github/callback") {
		return finishGitHubLogin(request, env, origin);
	}
	if (
		import.meta.env.DEV &&
		request.method === "GET" &&
		pathname === "/__dev/login"
	) {
		return devLogin(request, env);
	}
	if (pathname.startsWith("/api/web/")) {
		try {
			return await webEndpoint(request, env, origin, pathname);
		} catch (error) {
			if (error instanceof OAuthError) {
				throw new HttpError(error.status, error.error, error.message);
			}
			throw error;
		}
	}
	return null;
}
