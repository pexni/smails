import type { Me } from "../../worker/src/contract.ts";
import {
	type Credentials,
	deleteCredentials,
	loadCredentials,
	saveCredentials,
	withLock,
} from "./credentials.ts";

// 登录：标准的设备授权（RFC 8628）。拿到带用户码的链接，用户在浏览器里确认，我们每隔几秒问一次。
// 拿到的令牌和远程 MCP 用的是同一种（aud = <服务器>/mcp，/api 也接受）。

export const CLIENT_ID = "smails-cli";
const REFRESH_MARGIN_MS = 60_000;

export class NotSignedInError extends Error {
	constructor() {
		super("Not signed in. Run `npx @smails/cli login` first.");
	}
}

type TokenResponse = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
};

type DeviceStart = {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
	expires_in: number;
	interval: number;
};

async function postForm(
	server: string,
	path: string,
	values: Record<string, string>,
) {
	const response = await fetch(`${server}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: new URLSearchParams(values).toString(),
		signal: AbortSignal.timeout(15_000),
	});
	const body = (await response.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	return { ok: response.ok, body };
}

export async function startDeviceLogin(server: string): Promise<DeviceStart> {
	const { ok, body } = await postForm(server, "/device/code", {
		client_id: CLIENT_ID,
		resource: `${server}/mcp`,
	});
	if (!ok) {
		throw new Error(
			`Could not start sign-in: ${String(body.error_description ?? body.error ?? "unknown error")}`,
		);
	}
	return body as unknown as DeviceStart;
}

async function fetchLogin(server: string, token: string): Promise<string> {
	const response = await fetch(`${server}/api/me`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(15_000),
	});
	const me = (await response.json()) as Me;
	return me.user.github_login;
}

function toCredentials(
	tokens: TokenResponse,
	login: string,
	previous?: Credentials,
): Credentials {
	return {
		access_token: tokens.access_token,
		refresh_token: tokens.refresh_token,
		expires_at: Date.now() + tokens.expires_in * 1000,
		login,
		...(previous?.current_address
			? { current_address: previous.current_address }
			: {}),
	};
}

/** 轮询 /token，直到用户确认、拒绝或者码过期。 */
export async function finishDeviceLogin(
	server: string,
	start: DeviceStart,
): Promise<Credentials> {
	let interval = Math.max(start.interval, 1) * 1000;
	const deadline = Date.now() + start.expires_in * 1000;
	while (Date.now() < deadline) {
		// oxlint-disable-next-line no-await-in-loop -- 轮询本来就要按顺序
		await new Promise((resolve) => setTimeout(resolve, interval));
		// oxlint-disable-next-line no-await-in-loop
		const { ok, body } = await postForm(server, "/token", {
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			device_code: start.device_code,
			client_id: CLIENT_ID,
		});
		if (ok) {
			const tokens = body as unknown as TokenResponse;
			// oxlint-disable-next-line no-await-in-loop -- 只在成功时执行一次，然后就返回了
			const login = await fetchLogin(server, tokens.access_token);
			const credentials = toCredentials(tokens, login);
			saveCredentials(server, credentials);
			return credentials;
		}
		switch (body.error) {
			case "authorization_pending":
				continue;
			case "slow_down":
				interval += 5_000;
				continue;
			case "access_denied":
				throw new Error("Sign-in was declined.");
			case "expired_token":
				throw new Error("The sign-in code expired. Run `login` again.");
			default:
				throw new Error(
					`Sign-in failed: ${String(body.error_description ?? body.error ?? "unknown error")}`,
				);
		}
	}
	throw new Error("The sign-in code expired. Run `login` again.");
}

const inFlight = new Map<string, Promise<string>>();

async function refresh(server: string): Promise<string> {
	return withLock(async () => {
		// 拿到锁以后重新读：别的进程可能刚刚刷新过。
		const current = loadCredentials(server);
		if (!current) {
			throw new NotSignedInError();
		}
		if (current.expires_at - REFRESH_MARGIN_MS > Date.now()) {
			return current.access_token;
		}
		const { ok, body } = await postForm(server, "/token", {
			grant_type: "refresh_token",
			refresh_token: current.refresh_token,
			client_id: CLIENT_ID,
		});
		if (!ok) {
			if (body.error === "invalid_grant") {
				deleteCredentials(server);
				throw new NotSignedInError();
			}
			throw new Error(
				`Could not refresh the session: ${String(body.error ?? "unknown error")}`,
			);
		}
		const next = toCredentials(
			body as unknown as TokenResponse,
			current.login,
			current,
		);
		saveCredentials(server, next);
		return next.access_token;
	});
}

/** 拿一个还有效的访问令牌；快过期就刷新。同一个进程里并发调用只刷新一次。 */
export async function accessToken(
	server: string,
	options: { force?: boolean } = {},
): Promise<string> {
	const credentials = loadCredentials(server);
	if (!credentials) {
		throw new NotSignedInError();
	}
	if (
		!options.force &&
		credentials.expires_at - REFRESH_MARGIN_MS > Date.now()
	) {
		return credentials.access_token;
	}
	if (options.force) {
		// 强制刷新：让下面的检查一定走到刷新那一步。
		saveCredentials(server, { ...credentials, expires_at: 0 });
	}
	let pending = inFlight.get(server);
	if (!pending) {
		pending = refresh(server).finally(() => inFlight.delete(server));
		inFlight.set(server, pending);
	}
	return pending;
}

export async function logout(server: string): Promise<boolean> {
	const credentials = loadCredentials(server);
	if (!credentials) {
		return false;
	}
	await postForm(server, "/revoke", { token: credentials.refresh_token }).catch(
		() => {},
	);
	deleteCredentials(server);
	return true;
}
