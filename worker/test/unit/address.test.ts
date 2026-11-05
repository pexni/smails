import { describe, expect, it } from "vitest";

import {
	generateLocalPart,
	isIssuedLocalPart,
	normalizeLocalPart,
} from "../../src/address.ts";

const SECRET = "test-secret";

describe("addresses", () => {
	it("generates addresses that pass their own checksum", async () => {
		for (let i = 0; i < 50; i++) {
			const local = await generateLocalPart(SECRET);
			expect(local).toMatch(/^[a-z]+-[a-z]+-[0-9a-z]{8}$/);
			expect(await isIssuedLocalPart(SECRET, local)).toBe(true);
		}
	});

	it("rejects addresses we did not issue", async () => {
		const local = await generateLocalPart(SECRET);
		expect(await isIssuedLocalPart("other-secret", local)).toBe(false);
		const flipped = local.slice(0, -1) + (local.endsWith("a") ? "b" : "a");
		expect(await isIssuedLocalPart(SECRET, flipped)).toBe(false);
		expect(await isIssuedLocalPart(SECRET, "admin")).toBe(false);
	});

	it("normalizes case, domain and plus tags", () => {
		expect(normalizeLocalPart("Brave-Otter-K3J9X2M8+GitHub@Smails.dev")).toBe(
			"brave-otter-k3j9x2m8",
		);
	});
});
