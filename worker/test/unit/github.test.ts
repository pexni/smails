import { describe, expect, it } from "vitest";

import { fetchGitHubUser, safeNext } from "../../src/github.ts";
import { HttpError } from "../../src/http.ts";
import { normalizeUserCode } from "../../src/oauth/device.ts";

describe("safeNext", () => {
	it("keeps same-site paths and refuses everything else", () => {
		expect(safeNext("/device?code=BCDF-GHJK")).toBe("/device?code=BCDF-GHJK");
		expect(safeNext("//evil.example")).toBe("/account");
		expect(safeNext("https://evil.example")).toBe("/account");
		expect(safeNext("/\\evil.example")).toBe("/account");
		expect(safeNext(null)).toBe("/account");
	});
});

describe("fetchGitHubUser", () => {
	const env = { GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" };

	const githubWith = (emails: unknown, emailsStatus = 200): typeof fetch =>
		(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("access_token")) {
				return Response.json({ access_token: "gho_x" });
			}
			if (url.endsWith("/user/emails")) {
				return Response.json(emails, { status: emailsStatus });
			}
			return Response.json({
				id: 1,
				login: "octocat",
				created_at: "2011-01-25T18:44:36Z",
			});
		}) as typeof fetch;

	it("exchanges the code and reads the profile and the verified primary email", async () => {
		const user = await fetchGitHubUser(
			env,
			"https://smails.dev",
			"c0de",
			githubWith([
				{ email: "old@example.com", primary: false, verified: true },
				{ email: "Octo@GitHub.com", primary: true, verified: true },
			]),
		);
		expect(user).toEqual({
			id: 1,
			login: "octocat",
			created_at: "2011-01-25T18:44:36Z",
			email: "octo@github.com",
		});
	});

	it("stores no email when the primary one is unverified or unreadable", async () => {
		const unverified = await fetchGitHubUser(
			env,
			"https://smails.dev",
			"c0de",
			githubWith([
				{ email: "octo@github.com", primary: true, verified: false },
			]),
		);
		expect(unverified.email).toBeNull();
		const denied = await fetchGitHubUser(
			env,
			"https://smails.dev",
			"c0de",
			githubWith({ message: "Not Found" }, 404),
		);
		expect(denied.email).toBeNull();
	});

	it("fails cleanly when GitHub refuses the code", async () => {
		const fetchImpl: typeof fetch = async () =>
			Response.json({ error: "bad_verification_code" });
		await expect(
			fetchGitHubUser(env, "https://smails.dev", "c0de", fetchImpl),
		).rejects.toBeInstanceOf(HttpError);
	});
});

describe("user codes", () => {
	it("normalizes what people type", () => {
		expect(normalizeUserCode("bcdf ghjk")).toBe("BCDF-GHJK");
		expect(normalizeUserCode("BCDF-GHJK")).toBe("BCDF-GHJK");
		expect(normalizeUserCode("BCDF")).toBe("");
	});
});
