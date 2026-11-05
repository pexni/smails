import type { ApiError } from "../../worker/src/contract.ts";
import { accessToken } from "./auth.ts";

export const DEFAULT_SERVER = "https://smails.dev";

/** 服务器地址：SMAILS_URL（旧版的 SMAILS_API_URL 也认），默认 https://smails.dev。 */
export function serverUrl(): string {
	return (
		process.env.SMAILS_URL ||
		process.env.SMAILS_API_URL ||
		DEFAULT_SERVER
	).replace(/\/+$/, "");
}

export class RequestError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

/** 调 /api：带上访问令牌；被拒绝（令牌刚好失效、密钥轮换了）就刷新一次再试。 */
export async function api<T>(
	server: string,
	path: string,
	init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
	const send = async (token: string) => {
		const headers = new Headers(init.headers);
		headers.set("Authorization", `Bearer ${token}`);
		headers.set("Accept", "application/json");
		try {
			return await fetch(`${server}${path}`, {
				...init,
				headers,
				signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
			});
		} catch (error) {
			if (error instanceof Error && error.name === "TimeoutError") {
				throw new Error(`Request timed out (${server})`, { cause: error });
			}
			throw new Error(`Network error: cannot reach ${server}`, {
				cause: error,
			});
		}
	};
	let response = await send(await accessToken(server));
	if (response.status === 401) {
		response = await send(await accessToken(server, { force: true }));
	}
	if (response.status === 204) {
		return undefined as T;
	}
	const body = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) {
		const error = body as Partial<ApiError> | null;
		throw new RequestError(
			response.status,
			error?.error ?? "error",
			error?.message ?? `HTTP ${response.status}`,
		);
	}
	return body as T;
}
