import { SESSION_COOKIE } from "./contract.ts";
import { parseSecrets, signPayload, verifyPayload } from "./crypto.ts";
import { cookie, readCookie } from "./http.ts";

// 网页会话：签名 cookie，数据就在 cookie 里，不占存储。只在 smails.dev 的网页上用
// （Device Login 确认页、OAuth 授权确认页、账号页）；API 和 MCP 只认 Bearer 令牌。

const SESSION_PREFIX = "sms1";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type SessionData = { uid: number; login: string; exp: number };

export type WebUser = { id: number; github_login: string };

function secrets(env: Pick<Env, "SESSION_SECRETS">): string[] {
	return parseSecrets(env.SESSION_SECRETS, "SESSION_SECRETS");
}

export async function readSession(
	request: Request,
	env: Pick<Env, "SESSION_SECRETS">,
	now = Date.now(),
): Promise<WebUser | null> {
	const value = readCookie(request, SESSION_COOKIE);
	if (!value) {
		return null;
	}
	const data = (await verifyPayload(
		SESSION_PREFIX,
		value,
		secrets(env),
	)) as SessionData | null;
	if (
		!data ||
		typeof data.uid !== "number" ||
		typeof data.exp !== "number" ||
		data.exp <= now
	) {
		return null;
	}
	return { id: data.uid, github_login: data.login };
}

export async function sessionCookie(
	env: Pick<Env, "SESSION_SECRETS">,
	user: WebUser,
	now = Date.now(),
): Promise<string> {
	const data: SessionData = {
		uid: user.id,
		login: user.github_login,
		exp: now + SESSION_MAX_AGE_SECONDS * 1000,
	};
	return cookie(
		SESSION_COOKIE,
		await signPayload(SESSION_PREFIX, data, secrets(env)),
		SESSION_MAX_AGE_SECONDS,
	);
}

export function clearSessionCookie(): string {
	return cookie(SESSION_COOKIE, "", 0);
}
