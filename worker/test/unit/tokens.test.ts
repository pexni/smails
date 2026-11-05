import { describe, expect, it } from "vitest";

import { HttpError } from "../../src/http.ts";
import { authenticate, issueAccessToken } from "../../src/tokens.ts";

const env = { TOKEN_SECRETS: "k1" };
const options = {
	audiences: ["https://smails.dev/api", "https://smails.dev/mcp"],
	resourceMetadata: "https://smails.dev/.well-known/oauth-protected-resource",
};

function request(token?: string): Request {
	return new Request("https://smails.dev/api/me", {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
}

async function rejection(promise: Promise<unknown>): Promise<HttpError> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof HttpError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected a rejection");
}

const claims = {
	sub: 7,
	aud: "https://smails.dev/api",
	scope: "mail",
	plan: "free",
	cid: "cli",
};

describe("access tokens", () => {
	it("accepts a fresh token for an allowed audience", async () => {
		const { token } = await issueAccessToken(env, claims);
		expect((await authenticate(request(token), env, options)).sub).toBe(7);
	});

	it("asks for a token with a WWW-Authenticate challenge", async () => {
		const error = await rejection(authenticate(request(), env, options));
		expect(error.status).toBe(401);
		expect(new Headers(error.headers).get("WWW-Authenticate")).toContain(
			'resource_metadata="https://smails.dev/.well-known/oauth-protected-resource"',
		);
	});

	it("rejects expired tokens, other audiences and missing scopes", async () => {
		const old = await issueAccessToken(
			env,
			claims,
			Date.now() - 2 * 60 * 60 * 1000,
		);
		expect(
			(await rejection(authenticate(request(old.token), env, options))).code,
		).toBe("invalid_token");
		const other = await issueAccessToken(env, {
			...claims,
			aud: "https://evil.example/mcp",
		});
		expect(
			(await rejection(authenticate(request(other.token), env, options))).code,
		).toBe("invalid_token");
		const noScope = await issueAccessToken(env, { ...claims, scope: "other" });
		expect(
			(await rejection(authenticate(request(noScope.token), env, options)))
				.status,
		).toBe(403);
	});

	it("rejects tokens signed with another key", async () => {
		const { token } = await issueAccessToken({ TOKEN_SECRETS: "k2" }, claims);
		expect(
			(await rejection(authenticate(request(token), env, options))).code,
		).toBe("invalid_token");
	});
});
