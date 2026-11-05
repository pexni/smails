import { describe, expect, it } from "vitest";

import {
	fetchClientMetadata,
	isAcceptableRedirectUri,
	isCimdClientId,
	redirectUriMatches,
} from "../../src/oauth/clients.ts";
import { OAuthError } from "../../src/oauth/errors.ts";

describe("redirect URIs", () => {
	it("accepts https, loopback http and private schemes", () => {
		expect(
			isAcceptableRedirectUri("https://claude.ai/api/mcp/auth_callback"),
		).toBe(true);
		expect(isAcceptableRedirectUri("http://127.0.0.1:33418/callback")).toBe(
			true,
		);
		expect(
			isAcceptableRedirectUri("http://localhost:6274/oauth/callback"),
		).toBe(true);
		expect(
			isAcceptableRedirectUri(
				"cursor://anysphere.cursor-retrieval/oauth/callback",
			),
		).toBe(true);
	});

	it("refuses dangerous or remote-http redirect URIs", () => {
		for (const uri of [
			"http://evil.example/cb",
			"javascript:alert(1)",
			"data:text/html,hi",
			"file:///etc/passwd",
			"https://ok.example/cb#frag",
			"c:/windows",
			"not a url",
		]) {
			expect(isAcceptableRedirectUri(uri), uri).toBe(false);
		}
	});

	it("matches exactly, except for the loopback port", () => {
		const registered = ["https://app.example/cb", "http://127.0.0.1/callback"];
		expect(redirectUriMatches(registered, "https://app.example/cb")).toBe(true);
		expect(redirectUriMatches(registered, "https://app.example/cb/")).toBe(
			false,
		);
		expect(redirectUriMatches(registered, "https://app.example/cb?x=1")).toBe(
			false,
		);
		expect(
			redirectUriMatches(registered, "http://127.0.0.1:51234/callback"),
		).toBe(true);
		expect(redirectUriMatches(registered, "http://127.0.0.1:51234/other")).toBe(
			false,
		);
		expect(
			redirectUriMatches(registered, "http://localhost:51234/callback"),
		).toBe(false);
	});
});

describe("client ID metadata documents", () => {
	it("only treats public https URLs with a path as CIMD ids", () => {
		expect(isCimdClientId("https://app.example/oauth/client.json")).toBe(true);
		expect(isCimdClientId("https://app.example/")).toBe(false);
		expect(isCimdClientId("http://app.example/client.json")).toBe(false);
		expect(isCimdClientId("https://127.0.0.1/client.json")).toBe(false);
		expect(isCimdClientId("https://localhost/client.json")).toBe(false);
		expect(isCimdClientId("https://user:pw@app.example/client.json")).toBe(
			false,
		);
		expect(isCimdClientId("dcr_abc")).toBe(false);
	});

	const id = "https://app.example/oauth/client.json";
	const serve =
		(body: unknown, init: ResponseInit = {}): typeof fetch =>
		async () =>
			new Response(
				typeof body === "string" ? body : JSON.stringify(body),
				init,
			);

	it("reads a valid document", async () => {
		const client = await fetchClientMetadata(
			id,
			serve({
				client_id: id,
				client_name: "App",
				redirect_uris: ["https://app.example/cb"],
			}),
		);
		expect(client).toMatchObject({
			kind: "cimd",
			name: "App",
			redirect_uris: ["https://app.example/cb"],
		});
	});

	it("rejects documents that lie about their id, need secrets, redirect or are too big", async () => {
		const cases: [string, typeof fetch][] = [
			[
				"wrong id",
				serve({
					client_id: "https://other.example/c.json",
					redirect_uris: ["https://a.example/cb"],
				}),
			],
			[
				"confidential",
				serve({
					client_id: id,
					token_endpoint_auth_method: "private_key_jwt",
					redirect_uris: ["https://a.example/cb"],
				}),
			],
			[
				"bad redirect",
				serve({ client_id: id, redirect_uris: ["http://evil.example/cb"] }),
			],
			[
				"redirect",
				serve("", { status: 302, headers: { Location: "https://x.example" } }),
			],
			[
				"too big",
				serve({
					client_id: id,
					redirect_uris: ["https://a.example/cb"],
					pad: "x".repeat(20_000),
				}),
			],
			["not json", serve("<html>")],
		];
		for (const [name, fetchImpl] of cases) {
			await expect(
				fetchClientMetadata(id, fetchImpl),
				name,
			).rejects.toBeInstanceOf(OAuthError);
		}
	});
});
