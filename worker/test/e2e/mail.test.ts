import { describe, expect, it } from "vitest";

import type {
	Mailbox,
	Message,
	MessageSummary,
	WaitResult,
} from "../../src/contract.ts";
import { api, deliver, freshUserId, ORIGIN, tokenFor } from "../helpers.ts";

async function newMailbox(token: string): Promise<Mailbox> {
	const response = await api(token, "/api/mailboxes", { method: "POST" });
	expect(response.status).toBe(201);
	return response.json();
}

describe("legacy anonymous API", () => {
	it("answers 410 with a migration hint", async () => {
		for (const [method, path] of [
			["POST", "/api/mailbox"],
			["GET", "/api/mailbox/messages"],
			["GET", "/api/domains"],
		] as const) {
			const response = await api(null, path, { method });
			expect(response.status).toBe(410);
			expect(
				((await response.json()) as { message: string }).message,
			).toContain("login");
		}
	});
});

describe("authentication", () => {
	it("challenges requests without a token", async () => {
		const response = await api(null, "/api/mailboxes");
		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain(
			`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
		);
	});

	it("rejects tokens issued for another resource", async () => {
		const token = await tokenFor(freshUserId(), {
			aud: "https://elsewhere.example/api",
		});
		expect((await api(token, "/api/mailboxes")).status).toBe(401);
	});
});

describe("mailboxes and messages", () => {
	it("creates a mailbox, receives mail and reads it", async () => {
		const token = await tokenFor(freshUserId());
		const mailbox = await newMailbox(token);
		expect(mailbox.address).toMatch(/^[a-z]+-[a-z]+-[0-9a-z]{8}@smails\.dev$/);

		const listed: Mailbox[] = await (await api(token, "/api/mailboxes")).json();
		expect(listed.map((m) => m.address)).toContain(mailbox.address);

		expect(
			(
				await deliver(mailbox.address, {
					subject: "Welcome",
					text: "Code: 424242",
				})
			).ok,
		).toBe(true);
		const messages: MessageSummary[] = await (
			await api(token, `/api/mailboxes/${mailbox.address}/messages`)
		).json();
		expect(messages).toHaveLength(1);
		expect(messages[0]).toMatchObject({
			subject: "Welcome",
			from_addr: "noreply@example.com",
		});

		const message: Message = await (
			await api(token, `/api/messages/${messages[0]!.id}`)
		).json();
		expect(message.text).toContain("424242");
	});

	it("delivers plus-tagged and upper-case addresses to the same inbox", async () => {
		const token = await tokenFor(freshUserId());
		const mailbox = await newMailbox(token);
		const [local, domain] = mailbox.address.split("@");
		await deliver(`${local!.toUpperCase()}+github@${domain}`, {
			subject: "Tagged",
		});
		const messages: MessageSummary[] = await (
			await api(token, `/api/mailboxes/${mailbox.address}/messages`)
		).json();
		expect(messages.map((m) => m.subject)).toEqual(["Tagged"]);
	});

	it("drops mail for addresses we never issued", async () => {
		const response = await deliver("admin@smails.dev");
		expect(response.ok).toBe(true);
	});

	it("hides other users' mailboxes and messages", async () => {
		const owner = await tokenFor(freshUserId());
		const stranger = await tokenFor(freshUserId());
		const mailbox = await newMailbox(owner);
		await deliver(mailbox.address);
		const [summary]: MessageSummary[] = await (
			await api(owner, `/api/mailboxes/${mailbox.address}/messages`)
		).json();

		expect(
			(await api(stranger, `/api/mailboxes/${mailbox.address}/messages`))
				.status,
		).toBe(404);
		expect((await api(stranger, `/api/messages/${summary!.id}`)).status).toBe(
			404,
		);
		expect(
			(
				await api(stranger, `/api/messages/${summary!.id}`, {
					method: "DELETE",
				})
			).status,
		).toBe(404);
	});

	it("stops serving a deleted mailbox", async () => {
		const token = await tokenFor(freshUserId());
		const mailbox = await newMailbox(token);
		expect(
			(
				await api(token, `/api/mailboxes/${mailbox.address}`, {
					method: "DELETE",
				})
			).status,
		).toBe(204);
		expect(
			(await api(token, `/api/mailboxes/${mailbox.address}/messages`)).status,
		).toBe(404);
	});

	it("enforces the daily quota", async () => {
		const token = await tokenFor(freshUserId());
		for (let i = 0; i < 20; i++) {
			await newMailbox(token);
		}
		const response = await api(token, "/api/mailboxes", { method: "POST" });
		expect(response.status).toBe(429);
		expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
	});
});

describe("wait", () => {
	it("returns as soon as a matching message arrives", async () => {
		const token = await tokenFor(freshUserId());
		const mailbox = await newMailbox(token);
		const since = Date.now();
		const started = Date.now();
		const waiting = api(
			token,
			`/api/mailboxes/${mailbox.address}/wait?since=${since}&timeout=20&subject=code`,
		);
		await new Promise((resolve) => setTimeout(resolve, 500));
		await deliver(mailbox.address, {
			subject: "Newsletter",
			text: "not this one",
		});
		await deliver(mailbox.address, {
			subject: "Your login code",
			text: "Code: 987654",
		});

		const result: WaitResult = await (await waiting).json();
		expect(result.message?.subject).toBe("Your login code");
		expect(result.message?.text).toContain("987654");
		expect(Date.now() - started).toBeLessThan(10_000);
	});

	it("returns mail that arrived before the wait started", async () => {
		const token = await tokenFor(freshUserId());
		const mailbox = await newMailbox(token);
		const since = Date.now() - 1;
		await deliver(mailbox.address, { subject: "Early" });
		const result: WaitResult = await (
			await api(
				token,
				`/api/mailboxes/${mailbox.address}/wait?since=${since}&timeout=5`,
			)
		).json();
		expect(result.message?.subject).toBe("Early");
	});

	it("times out with null", async () => {
		const token = await tokenFor(freshUserId());
		const mailbox = await newMailbox(token);
		const result: WaitResult = await (
			await api(token, `/api/mailboxes/${mailbox.address}/wait?timeout=1`)
		).json();
		expect(result.message).toBeNull();
	});
});
