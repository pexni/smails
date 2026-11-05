import type { ApiError } from "./contract.ts";

export function json(
	body: unknown,
	status = 200,
	headers?: HeadersInit,
): Response {
	const response = new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
	if (headers) {
		for (const [name, value] of new Headers(headers)) {
			response.headers.append(name, value);
		}
	}
	return response;
}

/** 业务错误：抛出后由入口统一转成 JSON 响应。 */
export class HttpError extends Error {
	readonly status: number;
	readonly code: string;
	readonly headers: HeadersInit | undefined;

	constructor(
		status: number,
		code: string,
		message: string,
		headers?: HeadersInit,
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.headers = headers;
	}
}

export function errorResponse(error: HttpError): Response {
	const body: ApiError = { error: error.code, message: error.message };
	return json(body, error.status, error.headers);
}

export async function readJson(
	request: Request,
): Promise<Record<string, unknown>> {
	const type = request.headers.get("Content-Type") ?? "";
	if (!type.includes("application/json")) {
		throw new HttpError(415, "unsupported_media_type", "Send a JSON body.");
	}
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new HttpError(
			400,
			"invalid_request",
			"The body must be a JSON object.",
		);
	}
	return body as Record<string, unknown>;
}

/** 同源检查：网页上所有改动状态的请求都要过它（cookie 会话的 CSRF 防护）。 */
export function assertSameOrigin(request: Request): void {
	const origin = request.headers.get("Origin");
	if (origin !== new URL(request.url).origin) {
		throw new HttpError(403, "forbidden", "Cross-origin request refused.");
	}
}

export function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie");
	if (!header) {
		return null;
	}
	for (const pair of header.split(";")) {
		const separator = pair.indexOf("=");
		if (separator < 0 || pair.slice(0, separator).trim() !== name) {
			continue;
		}
		try {
			return decodeURIComponent(pair.slice(separator + 1).trim());
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * 我们的 cookie 都用 `__Host-` 前缀：必须 Secure、Path=/、不带 Domain，子域名和别的路径都改不了它。
 * 浏览器把 http://localhost 当作安全上下文，本地开发也能用。
 */
export function cookie(
	name: string,
	value: string,
	maxAgeSeconds: number,
): string {
	return [
		`${name}=${encodeURIComponent(value)}`,
		`Max-Age=${maxAgeSeconds}`,
		"Path=/",
		"HttpOnly",
		"Secure",
		"SameSite=Lax",
	].join("; ");
}
