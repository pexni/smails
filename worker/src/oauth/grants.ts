import { randomToken, sha256Hex } from "../crypto.ts";
import { issueAccessToken } from "../tokens.ts";
import { OAuthError } from "./errors.ts";

// 签发令牌对：访问令牌（签名，不存储，1 小时）+ 刷新令牌（随机数，只存哈希，90 天，每次使用都轮换）。
// 同一次登录轮换出来的刷新令牌属于同一条“链”（family）：发现旧令牌被重复使用，就作废整条链。

const REFRESH_TOKEN_PREFIX = "smr1";
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type TokenResponse = {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
	refresh_token: string;
	scope: string;
};

type Grant = {
	userId: number;
	clientId: string;
	resource: string;
	scope: string;
	familyId: string;
};

export function newFamilyId(): string {
	return randomToken(18);
}

/**
 * 规范化 resource 参数（RFC 8707）：只接受本站的 MCP 和 API 两个资源。
 * 只写了站点根地址的，当作 MCP（MCP 规范允许客户端用根地址当资源）。没传就用默认值。
 */
export function canonicalResource(
	value: string | null | undefined,
	origin: string,
	fallback: "mcp" | "api",
): string {
	if (!value) {
		return `${origin}/${fallback}`;
	}
	const trimmed = value.replace(/\/+$/, "");
	if (trimmed === origin) {
		return `${origin}/mcp`;
	}
	if (trimmed === `${origin}/mcp` || trimmed === `${origin}/api`) {
		return trimmed;
	}
	throw new OAuthError(400, "invalid_target", `Unknown resource: ${value}`);
}

async function activeUser(
	env: Pick<Env, "CORE">,
	userId: number,
): Promise<{ plan: string }> {
	const user = await env.CORE.prepare(
		"SELECT plan, status FROM users WHERE id = ?",
	)
		.bind(userId)
		.first<{ plan: string; status: string }>();
	if (!user || user.status !== "active") {
		throw new OAuthError(400, "invalid_grant", "This account is not active.");
	}
	return user;
}

/** 签发一对新令牌。档位每次都从用户表现读，所以档位变化在下次刷新时生效。 */
export async function issueTokens(
	env: Pick<Env, "CORE" | "TOKEN_SECRETS">,
	grant: Grant,
	now = Date.now(),
): Promise<TokenResponse> {
	const { plan } = await activeUser(env, grant.userId);
	const access = await issueAccessToken(
		env,
		{
			sub: grant.userId,
			aud: grant.resource,
			scope: grant.scope,
			plan,
			cid: grant.clientId,
		},
		now,
	);
	const refresh = `${REFRESH_TOKEN_PREFIX}.${randomToken(32)}`;
	await env.CORE.prepare(
		`INSERT INTO refresh_tokens (token_hash, family_id, client_id, user_id, resource, scope, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			await sha256Hex(refresh),
			grant.familyId,
			grant.clientId,
			grant.userId,
			grant.resource,
			grant.scope,
			now + REFRESH_TOKEN_TTL_MS,
			now,
		)
		.run();
	return {
		access_token: access.token,
		token_type: "Bearer",
		expires_in: access.expiresIn,
		refresh_token: refresh,
		scope: grant.scope,
	};
}

export async function revokeFamily(
	env: Pick<Env, "CORE">,
	familyId: string,
	now = Date.now(),
): Promise<void> {
	await env.CORE.prepare(
		"UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL",
	)
		.bind(now, familyId)
		.run();
}

/**
 * 用刷新令牌换一对新令牌。标记“已轮换”用一条带条件的 UPDATE … RETURNING：
 * 同一个刷新令牌并发用两次，只有一个请求拿得到新令牌。
 * 已经轮换掉的令牌又出现了，说明它泄露了：作废整条链，攻击者和用户手上的都失效。
 */
export async function rotateRefreshToken(
	env: Pick<Env, "CORE" | "TOKEN_SECRETS">,
	token: string,
	clientId: string,
	resource: string | null,
	now = Date.now(),
): Promise<TokenResponse> {
	const hash = await sha256Hex(token);
	const claimed = await env.CORE.prepare(
		`UPDATE refresh_tokens SET rotated_at = ?1
		 WHERE token_hash = ?2 AND client_id = ?3 AND rotated_at IS NULL AND revoked_at IS NULL AND expires_at > ?1
		 RETURNING family_id, user_id, resource, scope`,
	)
		.bind(now, hash, clientId)
		.first<{
			family_id: string;
			user_id: number;
			resource: string;
			scope: string;
		}>();
	if (!claimed) {
		const row = await env.CORE.prepare(
			"SELECT family_id, rotated_at FROM refresh_tokens WHERE token_hash = ?",
		)
			.bind(hash)
			.first<{ family_id: string; rotated_at: number | null }>();
		if (row?.rotated_at) {
			await revokeFamily(env, row.family_id, now);
		}
		throw new OAuthError(
			400,
			"invalid_grant",
			"The refresh token is invalid or expired.",
		);
	}
	if (resource && resource !== claimed.resource) {
		throw new OAuthError(
			400,
			"invalid_target",
			"A refresh token can only be used for the resource it was issued for.",
		);
	}
	return issueTokens(
		env,
		{
			userId: claimed.user_id,
			clientId,
			resource: claimed.resource,
			scope: claimed.scope,
			familyId: claimed.family_id,
		},
		now,
	);
}

/** POST /revoke（RFC 7009）：作废刷新令牌所在的整条链。令牌不存在也回答 200。 */
export async function revokeRefreshToken(
	env: Pick<Env, "CORE">,
	token: string,
	now = Date.now(),
): Promise<void> {
	const row = await env.CORE.prepare(
		"SELECT family_id FROM refresh_tokens WHERE token_hash = ?",
	)
		.bind(await sha256Hex(token))
		.first<{ family_id: string }>();
	if (row) {
		await revokeFamily(env, row.family_id, now);
	}
}
