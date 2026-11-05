import {
	parseSecrets,
	randomToken,
	sha256Hex,
	signPayload,
	verifyPayload,
} from "../crypto.ts";
import { cookie, HttpError, readCookie } from "../http.ts";
import { SCOPE } from "../tokens.ts";
import { type Client, redirectUriMatches, resolveClient } from "./clients.ts";
import { OAuthError } from "./errors.ts";
import { canonicalResource, newFamilyId } from "./grants.ts";

// GET /authorize：校验请求，把它签名后放进一个短期 cookie，然后去确认页（/consent）。
// 确认页上用户点“允许”，才签发授权码跳回客户端。

const PENDING_COOKIE = "__Host-smails_oauth";
const PENDING_PREFIX = "smo1";
const PENDING_MAX_AGE_SECONDS = 10 * 60;
const AUTH_CODE_TTL_MS = 60 * 1000;

export type PendingAuthorization = {
	cid: string;
	ru: string;
	cc: string;
	st: string | null;
	sc: string;
	rs: string;
	exp: number;
};

/** 在客户端的 redirect_uri 上加参数，保留它原有的查询串。iss 是 RFC 9207 要求的。 */
export function redirectWith(
	redirectUri: string,
	params: Record<string, string | null>,
): string {
	const url = new URL(redirectUri);
	for (const [key, value] of Object.entries(params)) {
		if (value !== null) {
			url.searchParams.set(key, value);
		}
	}
	return url.toString();
}

function pendingSecrets(env: Pick<Env, "SESSION_SECRETS">): string[] {
	return parseSecrets(env.SESSION_SECRETS, "SESSION_SECRETS");
}

export async function startAuthorization(
	request: Request,
	env: Pick<Env, "CORE" | "SESSION_SECRETS">,
	origin: string,
	now = Date.now(),
): Promise<Response> {
	const params = new URL(request.url).searchParams;
	const clientId = params.get("client_id");
	const redirectUri = params.get("redirect_uri");
	// client_id 和 redirect_uri 不对时不能跳回去（跳回去就成了开放跳转），只能显示错误。
	if (!clientId || !redirectUri) {
		throw new HttpError(
			400,
			"invalid_request",
			"client_id and redirect_uri are required.",
		);
	}
	let client: Client;
	try {
		client = await resolveClient(env, clientId, { now });
	} catch (error) {
		if (error instanceof OAuthError) {
			throw new HttpError(400, error.error, error.message);
		}
		throw error;
	}
	if (!redirectUriMatches(client.redirect_uris, redirectUri)) {
		throw new HttpError(
			400,
			"invalid_request",
			"redirect_uri does not match the client's registered redirect URIs.",
		);
	}

	// 从这里开始，错误按 OAuth 的方式跳回客户端。
	const state = params.get("state");
	const fail = (error: string, description: string) =>
		Response.redirect(
			redirectWith(redirectUri, {
				error,
				error_description: description,
				state,
				iss: origin,
			}),
			302,
		);
	if (params.get("response_type") !== "code") {
		return fail(
			"unsupported_response_type",
			"Only response_type=code is supported.",
		);
	}
	const challenge = params.get("code_challenge");
	if (
		!challenge ||
		params.get("code_challenge_method") !== "S256" ||
		!/^[A-Za-z0-9_-]{43}$/.test(challenge)
	) {
		return fail(
			"invalid_request",
			"PKCE with code_challenge_method=S256 is required.",
		);
	}
	let resource: string;
	try {
		resource = canonicalResource(params.get("resource"), origin, "mcp");
	} catch {
		return fail("invalid_target", "Unknown resource.");
	}

	const pending: PendingAuthorization = {
		cid: client.client_id,
		ru: redirectUri,
		cc: challenge,
		st: state,
		// 只有一种权限。客户端请求了什么（或者没写），都授予 mail；不认识的 scope 忽略。
		sc: SCOPE,
		rs: resource,
		exp: now + PENDING_MAX_AGE_SECONDS * 1000,
	};
	return new Response(null, {
		status: 302,
		headers: {
			Location: "/consent",
			"Set-Cookie": cookie(
				PENDING_COOKIE,
				await signPayload(PENDING_PREFIX, pending, pendingSecrets(env)),
				PENDING_MAX_AGE_SECONDS,
			),
			"Cache-Control": "no-store",
		},
	});
}

export async function readPending(
	request: Request,
	env: Pick<Env, "SESSION_SECRETS">,
	now = Date.now(),
): Promise<PendingAuthorization> {
	const value = readCookie(request, PENDING_COOKIE);
	const pending = value
		? ((await verifyPayload(
				PENDING_PREFIX,
				value,
				pendingSecrets(env),
			)) as PendingAuthorization | null)
		: null;
	if (!pending || pending.exp <= now) {
		throw new HttpError(
			404,
			"no_pending_request",
			"This authorization request has expired. Go back to your app and connect again.",
		);
	}
	return pending;
}

export function clearPendingCookie(): string {
	return cookie(PENDING_COOKIE, "", 0);
}

/** 用户点了“允许”：签发授权码（只存哈希，60 秒，只能用一次），返回要跳回的地址。 */
export async function approveAuthorization(
	env: Pick<Env, "CORE">,
	pending: PendingAuthorization,
	userId: number,
	origin: string,
	now = Date.now(),
): Promise<string> {
	const code = randomToken(32);
	await env.CORE.prepare(
		`INSERT INTO auth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, resource, scope, family_id, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			await sha256Hex(code),
			pending.cid,
			userId,
			pending.ru,
			pending.cc,
			pending.rs,
			pending.sc,
			newFamilyId(),
			now + AUTH_CODE_TTL_MS,
		)
		.run();
	return redirectWith(pending.ru, { code, state: pending.st, iss: origin });
}

export function denyAuthorization(
	pending: PendingAuthorization,
	origin: string,
): string {
	return redirectWith(pending.ru, {
		error: "access_denied",
		error_description: "The user declined.",
		state: pending.st,
		iss: origin,
	});
}
