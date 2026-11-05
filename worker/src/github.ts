import {
	parseSecrets,
	randomToken,
	signPayload,
	verifyPayload,
} from "./crypto.ts";
import { cookie, HttpError, readCookie } from "./http.ts";
import { sessionCookie, type WebUser } from "./session.ts";

// GitHub 用来确认“你是谁”：网页上跳转到 GitHub 授权，回来后读一次 /user 和 /user/emails，
// 然后就不再用它的令牌。只申请 user:email（读邮箱地址），不申请其他权限。

const STATE_COOKIE = "__Host-smails_gh";
const STATE_PREFIX = "smg1";
const STATE_MAX_AGE_SECONDS = 10 * 60;

/** GitHub 账号注册满这么多天才能登录：防止批量养号。 */
export const MIN_GITHUB_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type GitHubUser = {
	id: number;
	login: string;
	created_at: string;
	/** GitHub 上已验证的主邮箱；没有就是 null。 */
	email: string | null;
};

type StateData = { state: string; next: string; exp: number };

/** 登录后要回到的站内路径：只接受以单个 / 开头的相对路径，防止被拿来跳到别的网站。 */
export function safeNext(value: string | null): string {
	if (
		!value ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\")
	) {
		return "/account";
	}
	return value;
}

/** GET /oauth/github/start?next=/device?code=... */
export async function startGitHubLogin(
	request: Request,
	env: Pick<Env, "GITHUB_CLIENT_ID" | "SESSION_SECRETS">,
	origin: string,
	now = Date.now(),
): Promise<Response> {
	if (!env.GITHUB_CLIENT_ID) {
		throw new HttpError(
			503,
			"github_not_configured",
			"GitHub sign-in is not configured.",
		);
	}
	const next = safeNext(new URL(request.url).searchParams.get("next"));
	const state = randomToken(24);
	const data: StateData = {
		state,
		next,
		exp: now + STATE_MAX_AGE_SECONDS * 1000,
	};
	const signed = await signPayload(
		STATE_PREFIX,
		data,
		parseSecrets(env.SESSION_SECRETS, "SESSION_SECRETS"),
	);
	const authorize = new URL("https://github.com/login/oauth/authorize");
	authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
	authorize.searchParams.set("redirect_uri", `${origin}/oauth/github/callback`);
	authorize.searchParams.set("state", state);
	authorize.searchParams.set("scope", "user:email");
	authorize.searchParams.set("allow_signup", "true");
	return new Response(null, {
		status: 302,
		headers: {
			Location: authorize.toString(),
			"Set-Cookie": cookie(STATE_COOKIE, signed, STATE_MAX_AGE_SECONDS),
			"Cache-Control": "no-store",
		},
	});
}

/** 用 GitHub 回调里的 code 换令牌，再读一次 /user。 */
export async function fetchGitHubUser(
	env: Pick<Env, "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET">,
	origin: string,
	code: string,
	fetchImpl: typeof fetch = fetch,
): Promise<GitHubUser> {
	const exchange = await fetchImpl(
		"https://github.com/login/oauth/access_token",
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
				redirect_uri: `${origin}/oauth/github/callback`,
			}),
		},
	);
	const token = (await exchange.json().catch(() => null)) as {
		access_token?: string;
	} | null;
	if (!exchange.ok || !token?.access_token) {
		throw new HttpError(
			502,
			"github_failed",
			"GitHub did not accept the sign-in. Try again.",
		);
	}
	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token.access_token}`,
		"User-Agent": "smails",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const [response, emailsResponse] = await Promise.all([
		fetchImpl("https://api.github.com/user", { headers }),
		fetchImpl("https://api.github.com/user/emails", { headers }),
	]);
	const user = (await response
		.json()
		.catch(() => null)) as Partial<GitHubUser> | null;
	if (
		!response.ok ||
		typeof user?.id !== "number" ||
		typeof user.login !== "string" ||
		typeof user.created_at !== "string"
	) {
		throw new HttpError(
			502,
			"github_failed",
			"Could not read your GitHub profile. Try again.",
		);
	}
	// 已验证的主邮箱。读不到（用户拒绝了权限之类）也不挡登录，只是先不存。
	const emails = (await emailsResponse.json().catch(() => null)) as
		| { email?: unknown; primary?: unknown; verified?: unknown }[]
		| null;
	const primary = Array.isArray(emails)
		? emails.find((entry) => entry.primary === true && entry.verified === true)
		: undefined;
	return {
		id: user.id,
		login: user.login,
		created_at: user.created_at,
		email:
			emailsResponse.ok && typeof primary?.email === "string"
				? primary.email.toLowerCase()
				: null,
	};
}

/** 写入或更新用户，返回我们自己的用户。太新的账号、被封禁的账号不让登录。 */
export async function upsertUser(
	env: Pick<Env, "CORE">,
	github: GitHubUser,
	now = Date.now(),
): Promise<WebUser> {
	const createdAt = Date.parse(github.created_at);
	if (
		!Number.isFinite(createdAt) ||
		now - createdAt < MIN_GITHUB_ACCOUNT_AGE_MS
	) {
		throw new HttpError(
			403,
			"account_too_new",
			"Your GitHub account is too new. Accounts must be at least 30 days old to use smails.",
		);
	}
	const row = await env.CORE.prepare(
		`INSERT INTO users (github_id, github_login, github_created_at, email, created_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (github_id) DO UPDATE SET
		   github_login = excluded.github_login,
		   email = COALESCE(excluded.email, users.email)
		 RETURNING id, github_login, status`,
	)
		.bind(github.id, github.login, createdAt, github.email, now)
		.first<{ id: number; github_login: string; status: string }>();
	if (!row) {
		throw new Error("users upsert returned nothing");
	}
	if (row.status !== "active") {
		throw new HttpError(
			403,
			"account_suspended",
			"This account has been suspended.",
		);
	}
	return { id: row.id, github_login: row.github_login };
}

/** GET /oauth/github/callback：校验 state，登录，然后回到 next。 */
export async function finishGitHubLogin(
	request: Request,
	env: Pick<
		Env,
		"CORE" | "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "SESSION_SECRETS"
	>,
	origin: string,
	now = Date.now(),
): Promise<Response> {
	const url = new URL(request.url);
	const stored = readCookie(request, STATE_COOKIE);
	const data = stored
		? ((await verifyPayload(
				STATE_PREFIX,
				stored,
				parseSecrets(env.SESSION_SECRETS, "SESSION_SECRETS"),
			)) as StateData | null)
		: null;
	if (
		!data ||
		data.exp <= now ||
		data.state !== url.searchParams.get("state")
	) {
		throw new HttpError(
			400,
			"invalid_state",
			"This sign-in link has expired. Start again.",
		);
	}
	const code = url.searchParams.get("code");
	if (!code) {
		throw new HttpError(400, "access_denied", "GitHub sign-in was cancelled.");
	}
	const user = await upsertUser(
		env,
		await fetchGitHubUser(env, origin, code),
		now,
	);
	const headers = new Headers({
		Location: safeNext(data.next),
		"Cache-Control": "no-store",
	});
	headers.append("Set-Cookie", await sessionCookie(env, user, now));
	headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
	return new Response(null, { status: 302, headers });
}
