import { sha256Base64Url, sha256Hex } from "../crypto.ts";
import { redeemDeviceCode } from "./device.ts";
import { OAuthError } from "./errors.ts";
import {
	canonicalResource,
	issueTokens,
	revokeFamily,
	rotateRefreshToken,
	type TokenResponse,
} from "./grants.ts";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
// RFC 7636：code_verifier 是 43–128 个 unreserved 字符。
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

type CodeRow = {
	client_id: string;
	user_id: number;
	redirect_uri: string;
	code_challenge: string;
	resource: string;
	scope: string;
	family_id: string;
	expires_at: number;
};

/**
 * 授权码换令牌。标记“已使用”用一条带条件的 UPDATE … RETURNING，同一个码只有一个请求换得到。
 * 码被重复使用（RFC 6749 §4.1.2 的要求）：作废用它换到的那条链。
 */
async function redeemAuthorizationCode(
	env: Pick<Env, "CORE" | "TOKEN_SECRETS">,
	form: URLSearchParams,
	clientId: string,
	origin: string,
	now: number,
): Promise<TokenResponse> {
	const code = form.get("code");
	const verifier = form.get("code_verifier");
	const redirectUri = form.get("redirect_uri");
	if (!code || !verifier || !redirectUri) {
		throw new OAuthError(
			400,
			"invalid_request",
			"code, code_verifier and redirect_uri are required.",
		);
	}
	const hash = await sha256Hex(code);
	const row = await env.CORE.prepare(
		"UPDATE auth_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL RETURNING *",
	)
		.bind(now, hash)
		.first<CodeRow>();
	if (!row) {
		const used = await env.CORE.prepare(
			"SELECT family_id FROM auth_codes WHERE code_hash = ?",
		)
			.bind(hash)
			.first<{ family_id: string }>();
		if (used) {
			await revokeFamily(env, used.family_id, now);
		}
		throw new OAuthError(
			400,
			"invalid_grant",
			"The authorization code is invalid.",
		);
	}
	if (row.expires_at <= now) {
		throw new OAuthError(
			400,
			"invalid_grant",
			"The authorization code has expired.",
		);
	}
	if (row.client_id !== clientId || row.redirect_uri !== redirectUri) {
		throw new OAuthError(
			400,
			"invalid_grant",
			"The code was issued to another client or redirect_uri.",
		);
	}
	if (
		!CODE_VERIFIER.test(verifier) ||
		(await sha256Base64Url(verifier)) !== row.code_challenge
	) {
		throw new OAuthError(400, "invalid_grant", "PKCE verification failed.");
	}
	const resource = form.get("resource");
	if (resource && canonicalResource(resource, origin, "mcp") !== row.resource) {
		throw new OAuthError(
			400,
			"invalid_target",
			"resource does not match the authorization request.",
		);
	}
	return issueTokens(
		env,
		{
			userId: row.user_id,
			clientId,
			resource: row.resource,
			scope: row.scope,
			familyId: row.family_id,
		},
		now,
	);
}

/** POST /token。公开客户端：不验客户端密钥，靠 PKCE、设备码和刷新令牌本身。 */
export async function handleToken(
	env: Pick<Env, "CORE" | "TOKEN_SECRETS">,
	form: URLSearchParams,
	origin: string,
	now = Date.now(),
): Promise<TokenResponse> {
	const clientId = form.get("client_id");
	if (!clientId) {
		throw new OAuthError(400, "invalid_request", "client_id is required.");
	}
	switch (form.get("grant_type")) {
		case "authorization_code":
			return redeemAuthorizationCode(env, form, clientId, origin, now);
		case "refresh_token": {
			const token = form.get("refresh_token");
			if (!token) {
				throw new OAuthError(
					400,
					"invalid_request",
					"refresh_token is required.",
				);
			}
			const resource = form.get("resource");
			return rotateRefreshToken(
				env,
				token,
				clientId,
				resource ? canonicalResource(resource, origin, "mcp") : null,
				now,
			);
		}
		case DEVICE_GRANT: {
			const deviceCode = form.get("device_code");
			if (!deviceCode) {
				throw new OAuthError(
					400,
					"invalid_request",
					"device_code is required.",
				);
			}
			return redeemDeviceCode(env, deviceCode, clientId, now);
		}
		default:
			throw new OAuthError(
				400,
				"unsupported_grant_type",
				"Unsupported grant_type.",
			);
	}
}
