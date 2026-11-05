import { parseSecrets, signPayload, verifyPayload } from "./crypto.ts";
import { HttpError } from "./http.ts";

// 访问令牌：`sma1.<base64url(声明)>.<base64url(HMAC)>`，1 小时有效。
// 不存储，验签即可：每个 API 请求都不读 KV 也不读 D1。

export const ACCESS_TOKEN_PREFIX = "sma1";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

/** 只有一种权限：用邮箱。 */
export const SCOPE = "mail";

export type AccessClaims = {
	/** 用户 id（core.users.id）。 */
	sub: number;
	/** 这个令牌签发给谁用：远程 MCP 或 API。 */
	aud: string;
	scope: string;
	/** 用户档位：配额检查不用查用户表，档位变化最多 1 小时后生效。 */
	plan: string;
	/** OAuth 客户端 id。 */
	cid: string;
	iat: number;
	exp: number;
};

export function resourceUrls(domain: string) {
	const origin = `https://${domain}`;
	return { origin, mcp: `${origin}/mcp`, api: `${origin}/api` };
}

/** 本地开发时 issuer 和资源地址跟着请求的 origin 走（http://localhost:8792）。 */
export function originOf(request: Request, domain: string): string {
	const url = new URL(request.url);
	return url.hostname === domain ? `https://${domain}` : url.origin;
}

export async function issueAccessToken(
	env: Pick<Env, "TOKEN_SECRETS">,
	claims: Omit<AccessClaims, "iat" | "exp">,
	now = Date.now(),
): Promise<{ token: string; expiresIn: number }> {
	const iat = Math.floor(now / 1000);
	const payload: AccessClaims = {
		...claims,
		iat,
		exp: iat + ACCESS_TOKEN_TTL_SECONDS,
	};
	const token = await signPayload(
		ACCESS_TOKEN_PREFIX,
		payload,
		parseSecrets(env.TOKEN_SECRETS, "TOKEN_SECRETS"),
	);
	return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

function isClaims(value: unknown): value is AccessClaims {
	if (!value || typeof value !== "object") {
		return false;
	}
	const claims = value as Record<string, unknown>;
	return (
		typeof claims.sub === "number" &&
		typeof claims.aud === "string" &&
		typeof claims.scope === "string" &&
		typeof claims.plan === "string" &&
		typeof claims.cid === "string" &&
		typeof claims.iat === "number" &&
		typeof claims.exp === "number"
	);
}

/**
 * 校验 `Authorization: Bearer` 里的访问令牌。只接受放在请求头里的令牌，
 * 不接受出现在 URL 里的（MCP 规范的要求，也免得令牌进日志）。
 * 失败时抛 401，并带上 `WWW-Authenticate`，MCP 客户端靠它找到授权服务器。
 */
export async function authenticate(
	request: Request,
	env: Pick<Env, "TOKEN_SECRETS">,
	options: { audiences: string[]; resourceMetadata: string },
	now = Date.now(),
): Promise<AccessClaims> {
	const challenge = (error?: string) =>
		[
			`Bearer resource_metadata="${options.resourceMetadata}"`,
			`scope="${SCOPE}"`,
			...(error ? [`error="${error}"`] : []),
		].join(", ");

	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) {
		throw new HttpError(
			401,
			"unauthorized",
			"Sign in first: run `npx @smails/cli login`.",
			{
				"WWW-Authenticate": challenge(),
			},
		);
	}
	const payload = await verifyPayload(
		ACCESS_TOKEN_PREFIX,
		header.slice("Bearer ".length).trim(),
		parseSecrets(env.TOKEN_SECRETS, "TOKEN_SECRETS"),
	);
	if (!isClaims(payload) || payload.exp * 1000 <= now) {
		throw new HttpError(
			401,
			"invalid_token",
			"The access token is invalid or expired.",
			{
				"WWW-Authenticate": challenge("invalid_token"),
			},
		);
	}
	if (!options.audiences.includes(payload.aud)) {
		throw new HttpError(
			401,
			"invalid_token",
			"This token was issued for another resource.",
			{
				"WWW-Authenticate": challenge("invalid_token"),
			},
		);
	}
	if (!payload.scope.split(" ").includes(SCOPE)) {
		throw new HttpError(
			403,
			"insufficient_scope",
			"The token lacks the mail scope.",
			{
				"WWW-Authenticate": challenge("insufficient_scope"),
			},
		);
	}
	return payload;
}
