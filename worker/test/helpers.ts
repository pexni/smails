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
