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

	it("exchanges the code and reads the profile", async () => {
		const calls: string[] = [];
		const fetchImpl: typeof fetch = async (input) => {
			const url = String(input);
			calls.push(url);
			return url.includes("access_token")
				? Response.json({ access_token: "gho_x" })
				: Response.json({
						id: 1,
						login: "octocat",
						created_at: "2011-01-25T18:44:36Z",
					});
		};
		expect(
			await fetchGitHubUser(env, "https://smails.dev", "c0de", fetchImpl),
		).toEqual({
			id: 1,
			login: "octocat",
			created_at: "2011-01-25T18:44:36Z",
		});
		expect(calls).toEqual([
			"https://github.com/login/oauth/access_token",
			"https://api.github.com/user",
		]);
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
