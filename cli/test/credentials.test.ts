import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	deleteCredentials,
	loadCredentials,
	saveCredentials,
	updateCredentials,
	withLock,
} from "../src/credentials.ts";

const sample = {
	access_token: "sma1.a.b",
	refresh_token: "smr1.x",
	expires_at: Date.now() + 3_600_000,
	login: "octocat",
};

let home: string;

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "smails-cred-"));
	process.env.XDG_CONFIG_HOME = home;
});

afterEach(() => {
	rmSync(home, { recursive: true, force: true });
});

describe("credentials", () => {
	it("stores one entry per server with private permissions", () => {
		saveCredentials("https://smails.dev", sample);
		saveCredentials("http://localhost:8792", { ...sample, login: "dev" });
		expect(loadCredentials("https://smails.dev")?.login).toBe("octocat");
		expect(loadCredentials("http://localhost:8792")?.login).toBe("dev");
		expect(statSync(join(home, "smails/credentials.json")).mode & 0o777).toBe(
			0o600,
		);

		updateCredentials("https://smails.dev", {
			current_address: "a@smails.dev",
		});
		expect(loadCredentials("https://smails.dev")?.current_address).toBe(
			"a@smails.dev",
		);
		deleteCredentials("https://smails.dev");
		expect(loadCredentials("https://smails.dev")).toBeNull();
		expect(loadCredentials("http://localhost:8792")).not.toBeNull();
	});

	it("serializes work under the lock", async () => {
		const order: string[] = [];
		const task = (name: string) =>
			withLock(async () => {
				order.push(`${name}:start`);
				await new Promise((resolve) => setTimeout(resolve, 50));
				order.push(`${name}:end`);
			});
		await Promise.all([task("a"), task("b")]);
		expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
	});
});
