import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { issueAccessToken } from "../src/tokens.ts";

export const ORIGIN = "http://localhost:8794";

/** 测试和开发服务器读同一份 worker/.env。 */
export function devEnv(): Record<string, string> {
	const text = readFileSync(
		fileURLToPath(new URL("../.env", import.meta.url).href),
		"utf8",
	);
	const env: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
		if (match) {
			env[match[1]!] = match[2]!;
		}
	}
	return env;
}

let nextUser = Math.floor(Date.now() % 1_000_000) * 10;

/** 每个测试用一个新的用户 id，配额互不影响。 */
export function freshUserId(): number {
	nextUser += 1;
	return nextUser;
}

export async function tokenFor(
	sub: number,
	options: { aud?: string; plan?: string } = {},
): Promise<string> {
	const { token } = await issueAccessToken(
		{ TOKEN_SECRETS: devEnv().TOKEN_SECRETS! },
		{
			sub,
			aud: options.aud ?? `${ORIGIN}/api`,
			scope: "mail",
			plan: options.plan ?? "free",
			cid: "test",
		},
	);
	return token;
}

export async function api(
	token: string | null,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	return fetch(`${ORIGIN}${path}`, { ...init, headers });
}

/** 通过本地开发服务器模拟收到一封邮件。 */
export async function deliver(
	to: string,
	options: { from?: string; subject?: string; text?: string } = {},
): Promise<Response> {
	const from = options.from ?? "noreply@example.com";
	const raw = [
		`From: Example <${from}>`,
		`To: ${to}`,
		`Subject: ${options.subject ?? "Your code"}`,
		`Message-ID: <${crypto.randomUUID()}@example.com>`,
		`Date: ${new Date().toUTCString()}`,
		"Content-Type: text/plain; charset=utf-8",
		"",
		options.text ?? "Your verification code is 123456.",
		"",
	].join("\r\n");
	return fetch(
		`${ORIGIN}/cdn-cgi/local/email?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
		{ method: "POST", body: raw },
	);
}

/** 很小的 cookie jar：记下 Set-Cookie，后续请求带上。用来模拟一个浏览器。 */
export class Browser {
	private readonly cookies = new Map<string, string>();

	async fetch(path: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);
		if (this.cookies.size > 0) {
			headers.set(
				"Cookie",
				[...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
			);
		}
		const response = await fetch(
			path.startsWith("http") ? path : `${ORIGIN}${path}`,
			{
				...init,
				headers,
				redirect: "manual",
			},
		);
		for (const line of response.headers.getSetCookie()) {
			const [pair = "", ...attributes] = line.split(";");
			const separator = pair.indexOf("=");
			const name = pair.slice(0, separator).trim();
			const value = pair.slice(separator + 1).trim();
			const expired = attributes.some((attribute) =>
				/max-age=0\b/i.test(attribute.trim()),
			);
			if (expired || !value) {
				this.cookies.delete(name);
			} else {
				this.cookies.set(name, value);
			}
		}
		return response;
	}

	/** 网页上的同源 POST。 */
	post(path: string, body: unknown, origin = ORIGIN): Promise<Response> {
		return this.fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json", Origin: origin },
			body: JSON.stringify(body),
		});
	}

	async signIn(login: string): Promise<void> {
		const response = await this.fetch(
			`/__dev/login?login=${login}&next=/account`,
		);
		if (response.status !== 302) {
			throw new Error(`dev login failed: ${response.status}`);
		}
	}
}

export function form(values: Record<string, string>): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(values).toString(),
	};
}

export async function pkcePair(): Promise<{
	verifier: string;
	challenge: string;
}> {
	const { toBase64Url, sha256Base64Url } = await import("../src/crypto.ts");
	const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	return { verifier, challenge: await sha256Base64Url(verifier) };
}
