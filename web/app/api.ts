import type {
	Account,
	DeviceRequest,
	OAuthPending,
	WebSession,
} from "../../worker/src/contract.ts";

// 网页调用 Worker 的接口（/api/web/*，认 cookie 会话）。只在浏览器里调用。

export class WebApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		...init,
		credentials: "same-origin",
		headers: {
			Accept: "application/json",
			...(init.body ? { "Content-Type": "application/json" } : {}),
		},
	});
	const body = (await response.json().catch(() => null)) as {
		message?: string;
	} | null;
	if (!response.ok) {
		throw new WebApiError(
			response.status,
			body?.message ?? `HTTP ${response.status}`,
		);
	}
	return body as T;
}

const post = <T>(path: string, body: unknown) =>
	request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const getSession = () => request<WebSession>("/api/web/session");
export const signOut = () => post<{ ok: true }>("/api/web/logout", {});
export const getAccount = () => request<Account>("/api/web/account");
export const revokeSession = (id: string) =>
	post<{ ok: true }>("/api/web/account/revoke", { id });
export const getDeviceRequest = (code: string) =>
	request<DeviceRequest>(`/api/web/device?code=${encodeURIComponent(code)}`);
export const decideDevice = (code: string, approve: boolean) =>
	post<{ ok: true }>("/api/web/device", { user_code: code, approve });
export const getPendingAuthorization = () =>
	request<OAuthPending>("/api/web/oauth/pending");
export const decideAuthorization = (approve: boolean) =>
	post<{ redirect: string }>("/api/web/oauth/consent", { approve });

/**
 * 去 GitHub 登录，登录后回到当前页面。这是 Worker 上的接口、不是前端的页面：
 * 链接上要加 rel="external"，否则路由会在浏览器里接管它，显示 404。
 */
export function signInHref(next: string): string {
	return `/oauth/github/start?next=${encodeURIComponent(next)}`;
}
