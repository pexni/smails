import type { DeviceRequest } from "../contract.ts";
import { randomToken, sha256Hex } from "../crypto.ts";
import { HttpError } from "../http.ts";
import { SCOPE } from "../tokens.ts";
import { resolveClient } from "./clients.ts";
import { OAuthError } from "./errors.ts";
import {
	canonicalResource,
	issueTokens,
	newFamilyId,
	type TokenResponse,
} from "./grants.ts";

// 设备授权（RFC 8628）：CLI 和本地 MCP 的登录。
// CLI 拿到一个带用户码的链接，用户在浏览器里打开、用 GitHub 登录、核对用户码、点“确认”。
// CLI 同时每 5 秒问一次 /token，确认了就拿到和远程 MCP 一样的令牌。

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
export const POLL_INTERVAL_SECONDS = 5;
// 用户码只用不容易念错、看错的大写辅音（没有元音，也就拼不出单词；没有 0/O、1/I 这类）。
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

function newUserCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const letters = [...bytes]
		.map((byte) => USER_CODE_ALPHABET.charAt(byte % 20))
		.join("");
	return `${letters.slice(0, 4)}-${letters.slice(4)}`;
}

/** 用户输入的码统一成 XXXX-XXXX：大小写、空格、少写的横线都不计较。 */
export function normalizeUserCode(value: string): string {
	const letters = value.toUpperCase().replace(/[^A-Z]/g, "");
	return letters.length === 8
		? `${letters.slice(0, 4)}-${letters.slice(4)}`
		: "";
}

/** POST /device/code */
export async function startDeviceAuthorization(
	env: Pick<Env, "CORE">,
	form: URLSearchParams,
	origin: string,
	now = Date.now(),
): Promise<Record<string, unknown>> {
	const clientId = form.get("client_id");
	if (!clientId) {
		throw new OAuthError(400, "invalid_request", "client_id is required.");
	}
	const client = await resolveClient(env, clientId, { now });
	if (client.kind !== "first_party") {
		throw new OAuthError(
			400,
			"unauthorized_client",
			"Device authorization is only available to the smails CLI.",
		);
	}
	// 默认签给 MCP：本地 MCP 把请求转发给远程 /mcp，而 /api 同时接受 MCP 和 API 两种令牌，
	// 所以 CLI 的同一个令牌两边都能用。
	const resource = canonicalResource(form.get("resource"), origin, "mcp");
	const deviceCode = randomToken(32);
	const userCode = newUserCode();
	await env.CORE.prepare(
		`INSERT INTO device_codes (device_hash, user_code, client_id, resource, scope, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			await sha256Hex(deviceCode),
			userCode,
			client.client_id,
			resource,
			SCOPE,
			now + DEVICE_CODE_TTL_MS,
			now,
		)
		.run();
	return {
		device_code: deviceCode,
		user_code: userCode,
		verification_uri: `${origin}/device`,
		verification_uri_complete: `${origin}/device?code=${userCode}`,
		expires_in: DEVICE_CODE_TTL_MS / 1000,
		interval: POLL_INTERVAL_SECONDS,
	};
}

type DeviceRow = {
	device_hash: string;
	user_code: string;
	client_id: string;
	resource: string;
	scope: string;
	status: string;
	user_id: number | null;
	expires_at: number;
	last_poll_at: number | null;
};

/** GET /api/web/device?code=：确认页上显示这是谁的登录请求。 */
export async function describeDeviceRequest(
	env: Pick<Env, "CORE">,
	code: string,
	now = Date.now(),
): Promise<DeviceRequest> {
	const userCode = normalizeUserCode(code);
	const row = userCode
		? await env.CORE.prepare(
				"SELECT user_code, client_id, status, expires_at FROM device_codes WHERE user_code = ?",
			)
				.bind(userCode)
				.first<
					Pick<DeviceRow, "user_code" | "client_id" | "status" | "expires_at">
				>()
		: null;
	if (!row || row.status !== "pending" || row.expires_at <= now) {
		throw new HttpError(
			404,
			"not_found",
			"This code is invalid or has expired.",
		);
	}
	const client = await resolveClient(env, row.client_id, { now });
	return {
		user_code: row.user_code,
		client_name: client.name,
		expires_at: row.expires_at,
	};
}

/** POST /api/web/device：用户在网页上确认或拒绝。只有还在等待的请求能被确认一次。 */
export async function decideDeviceRequest(
	env: Pick<Env, "CORE">,
	code: string,
	userId: number,
	approve: boolean,
	now = Date.now(),
): Promise<void> {
	const row = await env.CORE.prepare(
		`UPDATE device_codes SET status = ?1, user_id = ?2
		 WHERE user_code = ?3 AND status = 'pending' AND expires_at > ?4
		 RETURNING user_code`,
	)
		.bind(approve ? "approved" : "denied", userId, normalizeUserCode(code), now)
		.first();
	if (!row) {
		throw new HttpError(
			404,
			"not_found",
			"This code is invalid or has expired.",
		);
	}
}

/** /token 里 grant_type=urn:ietf:params:oauth:grant-type:device_code 的处理。 */
export async function redeemDeviceCode(
	env: Pick<Env, "CORE" | "TOKEN_SECRETS">,
	deviceCode: string,
	clientId: string,
	now = Date.now(),
): Promise<TokenResponse> {
	const hash = await sha256Hex(deviceCode);
	const row = await env.CORE.prepare(
		"SELECT * FROM device_codes WHERE device_hash = ?",
	)
		.bind(hash)
		.first<DeviceRow>();
	if (!row || row.client_id !== clientId) {
		throw new OAuthError(400, "invalid_grant", "Unknown device_code.");
	}
	if (row.expires_at <= now) {
		throw new OAuthError(
			400,
			"expired_token",
			"The device code has expired. Start again.",
		);
	}
	if (row.status === "denied") {
		throw new OAuthError(400, "access_denied", "The sign-in was declined.");
	}
	if (row.status === "used") {
		throw new OAuthError(
			400,
			"invalid_grant",
			"This device code has already been used.",
		);
	}
	if (row.status === "pending") {
		const tooSoon =
			row.last_poll_at !== null &&
			now - row.last_poll_at < (POLL_INTERVAL_SECONDS - 1) * 1000;
		await env.CORE.prepare(
			"UPDATE device_codes SET last_poll_at = ? WHERE device_hash = ?",
		)
			.bind(now, hash)
			.run();
		throw tooSoon
			? new OAuthError(
					400,
					"slow_down",
					"Polling too fast; wait 5 more seconds.",
				)
			: new OAuthError(
					400,
					"authorization_pending",
					"Waiting for the user to confirm.",
				);
	}
	// approved：只有一个请求拿得到令牌。
	const claimed = await env.CORE.prepare(
		"UPDATE device_codes SET status = 'used' WHERE device_hash = ? AND status = 'approved' RETURNING user_id",
	)
		.bind(hash)
		.first<{ user_id: number }>();
	if (!claimed) {
		throw new OAuthError(
			400,
			"invalid_grant",
			"This device code has already been used.",
		);
	}
	return issueTokens(
		env,
		{
			userId: claimed.user_id,
			clientId,
			resource: row.resource,
			scope: row.scope,
			familyId: newFamilyId(),
		},
		now,
	);
}
