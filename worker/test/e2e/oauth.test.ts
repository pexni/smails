import { describe, expect, it } from "vitest";

import type { Me, OAuthPending } from "../../src/contract.ts";
import { api, Browser, form, ORIGIN, pkcePair } from "../helpers.ts";

type Tokens = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string;
};

async function postToken(values: Record<string, string>): Promise<Response> {
	return fetch(`${ORIGIN}/token`, form(values));
}

async function uniqueLogin(prefix: string): Promise<string> {
	return `${prefix}${crypto.randomUUID().slice(0, 8)}`;
}

describe("metadata", () => {
	it("publishes protected resource and authorization server metadata with CORS", async () => {
		const resource = await fetch(
			`${ORIGIN}/.well-known/oauth-protected-resource/mcp`,
		);
		expect(resource.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(await resource.json<any>()).toMatchObject({
			resource: `${ORIGIN}/mcp`,
			authorization_servers: [ORIGIN],
		});

		const server = await (
			await fetch(`${ORIGIN}/.well-known/oauth-authorization-server`)
		).json<any>();
		expect(server).toMatchObject({
			issuer: ORIGIN,
			code_challenge_methods_supported: ["S256"],
			client_id_metadata_document_supported: true,
			authorization_response_iss_parameter_supported: true,
			device_authorization_endpoint: `${ORIGIN}/device/code`,
		});

		const preflight = await fetch(`${ORIGIN}/token`, { method: "OPTIONS" });
		expect(preflight.status).toBe(204);
	});
});

describe("device login (CLI)", () => {
	it("goes from code to tokens once the user confirms on the web", async () => {
		const start = await (
			await fetch(`${ORIGIN}/device/code`, form({ client_id: "smails-cli" }))
		).json<any>();
		expect(start.verification_uri_complete).toBe(
			`${ORIGIN}/device?code=${start.user_code}`,
		);
		expect(start.user_code).toMatch(
			/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/,
		);

		const poll = () =>
			postToken({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: start.device_code,
				client_id: "smails-cli",
			});
		expect((await (await poll()).json<any>()).error).toBe(
			"authorization_pending",
		);
		expect((await (await poll()).json<any>()).error).toBe("slow_down");

		const browser = new Browser();
		// 没登录看不到请求。
		expect(
			(await browser.fetch(`/api/web/device?code=${start.user_code}`)).status,
		).toBe(401);
		const login = await uniqueLogin("dev");
		await browser.signIn(login);
		const described = await (
			await browser.fetch(
				`/api/web/device?code=${start.user_code.toLowerCase()}`,
			)
		).json<any>();
		expect(described).toMatchObject({
			user_code: start.user_code,
			client_name: "smails CLI",
		});

		// 跨站的确认请求被拒绝。
		expect(
			(
				await browser.post(
					"/api/web/device",
					{ user_code: start.user_code, approve: true },
					"https://evil.example",
				)
			).status,
		).toBe(403);
		expect(
			(
				await browser.post("/api/web/device", {
					user_code: start.user_code,
					approve: true,
				})
			).status,
		).toBe(200);
		// 只能确认一次。
		expect(
			(
				await browser.post("/api/web/device", {
					user_code: start.user_code,
					approve: true,
				})
			).status,
		).toBe(404);

		await new Promise((resolve) => setTimeout(resolve, 4_100));
		const tokens: Tokens = await (await poll()).json<any>();
		expect(tokens.access_token).toMatch(/^sma1\./);
		expect(tokens.refresh_token).toMatch(/^smr1\./);

		const me: Me = await (
			await api(tokens.access_token, "/api/me")
		).json<any>();
		expect(me.user.github_login).toBe(login);
		expect(me.quota.mailboxes_per_day).toBe(20);

		// 用过的设备码不能再换。
		expect((await (await poll()).json<any>()).error).toBe("invalid_grant");
	});

	it("tells the CLI when the user declines", async () => {
		const start = await (
			await fetch(`${ORIGIN}/device/code`, form({ client_id: "smails-cli" }))
		).json<any>();
		const browser = new Browser();
		await browser.signIn(await uniqueLogin("dev"));
		await browser.post("/api/web/device", {
			user_code: start.user_code,
			approve: false,
		});
		const response = await postToken({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			device_code: start.device_code,
			client_id: "smails-cli",
		});
		expect((await response.json<any>()).error).toBe("access_denied");
	});

	it("refuses device authorization for third-party clients", async () => {
		const response = await fetch(
			`${ORIGIN}/device/code`,
			form({ client_id: "dcr_unknown" }),
		);
		expect(response.status).toBe(400);
	});
});

describe("authorization code flow (remote MCP)", () => {
	const redirectUri = "http://127.0.0.1/callback";

	async function register(): Promise<string> {
		const response = await fetch(`${ORIGIN}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				client_name: "Test MCP client",
				redirect_uris: [redirectUri],
			}),
		});
		expect(response.status).toBe(201);
		return (await response.json<any>()).client_id;
	}

	async function authorize(
		clientId: string,
		browser: Browser,
		challenge: string,
	) {
		const url = new URL(`${ORIGIN}/authorize`);
		url.search = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			// 本机回环地址：端口和注册时不同也可以。
			redirect_uri: "http://127.0.0.1:43123/callback",
			code_challenge: challenge,
			code_challenge_method: "S256",
			state: "xyz",
			resource: `${ORIGIN}/mcp`,
			scope: "mail",
		}).toString();
		return browser.fetch(url.toString());
	}

	async function fullFlow() {
		const clientId = await register();
		const browser = new Browser();
		const { verifier, challenge } = await pkcePair();
		const started = await authorize(clientId, browser, challenge);
		expect(started.status).toBe(302);
		expect(started.headers.get("Location")).toBe("/consent");

		const pending: OAuthPending = await (
			await browser.fetch("/api/web/oauth/pending")
		).json<any>();
		expect(pending).toMatchObject({
			client_name: "Test MCP client",
			redirect_host: "127.0.0.1:43123",
		});

		// 没登录不能同意。
		expect(
			(await browser.post("/api/web/oauth/consent", { approve: true })).status,
		).toBe(401);
		await browser.signIn(await uniqueLogin("mcp"));
		expect(
			(
				await browser.post(
					"/api/web/oauth/consent",
					{ approve: true },
					"https://evil.example",
				)
			).status,
		).toBe(403);
		const { redirect } = await (
			await browser.post("/api/web/oauth/consent", { approve: true })
		).json<any>();
		const back = new URL(redirect);
		expect(`${back.origin}${back.pathname}`).toBe(
			"http://127.0.0.1:43123/callback",
		);
		expect(back.searchParams.get("state")).toBe("xyz");
		expect(back.searchParams.get("iss")).toBe(ORIGIN);
		return { clientId, verifier, code: back.searchParams.get("code")! };
	}

	it("issues MCP-audience tokens for a valid code and PKCE verifier", async () => {
		const { clientId, verifier, code } = await fullFlow();
		const exchange = {
			grant_type: "authorization_code",
			code,
			code_verifier: verifier,
			client_id: clientId,
			redirect_uri: "http://127.0.0.1:43123/callback",
			resource: `${ORIGIN}/mcp`,
		};
		const tokens: Tokens = await (await postToken(exchange)).json<any>();
		expect(tokens.access_token).toMatch(/^sma1\./);
		// MCP 的令牌也能用 API。
		expect((await api(tokens.access_token, "/api/me")).status).toBe(200);

		// 授权码只能用一次；第二次用时，用它换到的刷新令牌也一起作废。
		expect((await (await postToken(exchange)).json<any>()).error).toBe(
			"invalid_grant",
		);
		const refreshed = await postToken({
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
			client_id: clientId,
		});
		expect((await refreshed.json<any>()).error).toBe("invalid_grant");
	});

	it("rejects a wrong verifier or a different redirect_uri", async () => {
		const { clientId, code } = await fullFlow();
		const response = await postToken({
			grant_type: "authorization_code",
			code,
			code_verifier: (await pkcePair()).verifier,
			client_id: clientId,
			redirect_uri: "http://127.0.0.1:43123/callback",
		});
		expect((await response.json<any>()).error).toBe("invalid_grant");

		const second = await fullFlow();
		const wrongRedirect = await postToken({
			grant_type: "authorization_code",
			code: second.code,
			code_verifier: second.verifier,
			client_id: second.clientId,
			redirect_uri: "http://127.0.0.1:43124/callback",
		});
		expect((await wrongRedirect.json<any>()).error).toBe("invalid_grant");
	});

	it("rotates refresh tokens and revokes the whole family on reuse", async () => {
		const { clientId, verifier, code } = await fullFlow();
		const first: Tokens = await (
			await postToken({
				grant_type: "authorization_code",
				code,
				code_verifier: verifier,
				client_id: clientId,
				redirect_uri: "http://127.0.0.1:43123/callback",
			})
		).json<any>();
		const second: Tokens = await (
			await postToken({
				grant_type: "refresh_token",
				refresh_token: first.refresh_token,
				client_id: clientId,
			})
		).json<any>();
		expect(second.refresh_token).not.toBe(first.refresh_token);

		// 旧的刷新令牌又出现了：整条链作废，连刚换到的新令牌也不能用。
		const replay = await postToken({
			grant_type: "refresh_token",
			refresh_token: first.refresh_token,
			client_id: clientId,
		});
		expect((await replay.json<any>()).error).toBe("invalid_grant");
		const afterReplay = await postToken({
			grant_type: "refresh_token",
			refresh_token: second.refresh_token,
			client_id: clientId,
		});
		expect((await afterReplay.json<any>()).error).toBe("invalid_grant");
	});

	it("never redirects for an unknown client or an unregistered redirect_uri", async () => {
		const browser = new Browser();
		const { challenge } = await pkcePair();
		const unknown = await authorize("dcr_nope", browser, challenge);
		expect(unknown.status).toBe(400);
		expect(unknown.headers.get("Location")).toBeNull();
		expect(unknown.headers.get("Content-Type")).toContain("text/html");

		const clientId = await register();
		const url = new URL(`${ORIGIN}/authorize`);
		url.search = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: "https://evil.example/callback",
			code_challenge: challenge,
			code_challenge_method: "S256",
		}).toString();
		const evil = await browser.fetch(url.toString());
		expect(evil.status).toBe(400);
		expect(evil.headers.get("Location")).toBeNull();
	});

	it("bounces requests without PKCE back to the client with an error", async () => {
		const clientId = await register();
		const url = new URL(`${ORIGIN}/authorize`);
		url.search = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri,
			state: "s1",
		}).toString();
		const response = await new Browser().fetch(url.toString());
		expect(response.status).toBe(302);
		const location = new URL(response.headers.get("Location")!);
		expect(location.searchParams.get("error")).toBe("invalid_request");
		expect(location.searchParams.get("state")).toBe("s1");
	});

	it("only registers public clients with safe redirect URIs", async () => {
		const bad = await fetch(`${ORIGIN}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ redirect_uris: ["http://evil.example/cb"] }),
		});
		expect(bad.status).toBe(400);
		const confidential = await fetch(`${ORIGIN}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				redirect_uris: ["https://ok.example/cb"],
				token_endpoint_auth_method: "client_secret_basic",
			}),
		});
		expect(confidential.status).toBe(400);
	});
});

describe("revocation", () => {
	it("revokes a refresh token family", async () => {
		const start = await (
			await fetch(`${ORIGIN}/device/code`, form({ client_id: "smails-cli" }))
		).json<any>();
		const browser = new Browser();
		await browser.signIn(await uniqueLogin("rev"));
		await browser.post("/api/web/device", {
			user_code: start.user_code,
			approve: true,
		});
		const tokens: Tokens = await (
			await postToken({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: start.device_code,
				client_id: "smails-cli",
			})
		).json<any>();
		expect(
			(await fetch(`${ORIGIN}/revoke`, form({ token: tokens.refresh_token })))
				.status,
		).toBe(200);
		const refreshed = await postToken({
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
			client_id: "smails-cli",
		});
		expect((await refreshed.json<any>()).error).toBe("invalid_grant");
	});
});

describe("account page API", () => {
	it("lists signed-in apps and only revokes the user's own", async () => {
		const login = await uniqueLogin("acct");
		const start = await (
			await fetch(`${ORIGIN}/device/code`, form({ client_id: "smails-cli" }))
		).json<any>();
		const browser = new Browser();
		await browser.signIn(login);
		await browser.post("/api/web/device", {
			user_code: start.user_code,
			approve: true,
		});
		const tokens = await (
			await postToken({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: start.device_code,
				client_id: "smails-cli",
			})
		).json<any>();
		expect(tokens.refresh_token).toBeTruthy();

		const account = await (await browser.fetch("/api/web/account")).json<any>();
		expect(account.user.github_login).toBe(login);
		expect(account.quota.mailboxes_per_day).toBe(20);
		expect(account.sessions).toHaveLength(1);
		expect(account.sessions[0].client_name).toBe("smails CLI");

		// 别人不能撤销这个登录，也看不到它。
		const stranger = new Browser();
		await stranger.signIn(await uniqueLogin("other"));
		expect(
			(
				await stranger.post("/api/web/account/revoke", {
					id: account.sessions[0].id,
				})
			).status,
		).toBe(404);
		// 跨站请求被拒绝。
		expect(
			(
				await browser.post(
					"/api/web/account/revoke",
					{ id: account.sessions[0].id },
					"https://evil.example",
				)
			).status,
		).toBe(403);

		expect(
			(
				await browser.post("/api/web/account/revoke", {
					id: account.sessions[0].id,
				})
			).status,
		).toBe(200);
		expect(
			(await (await browser.fetch("/api/web/account")).json<any>()).sessions,
		).toHaveLength(0);
		const refreshed = await postToken({
			grant_type: "refresh_token",
			refresh_token: tokens.refresh_token,
			client_id: "smails-cli",
		});
		expect((await refreshed.json<any>()).error).toBe("invalid_grant");
	});

	it("requires a session", async () => {
		expect((await new Browser().fetch("/api/web/account")).status).toBe(401);
	});
});
