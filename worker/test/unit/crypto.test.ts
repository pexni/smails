import { describe, expect, it } from "vitest";

import {
	fromBase64Url,
	sha256Base64Url,
	signPayload,
	timingSafeEqual,
	toBase64Url,
	verifyPayload,
} from "../../src/crypto.ts";

describe("base64url", () => {
	it("round-trips arbitrary bytes", () => {
		const bytes = crypto.getRandomValues(new Uint8Array(257));
		expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
	});

	it("rejects characters outside the alphabet", () => {
		expect(fromBase64Url("ab+c")).toBeNull();
		expect(fromBase64Url("ab/c")).toBeNull();
	});
});

describe("signed payloads", () => {
	it("verifies what it signed", async () => {
		const token = await signPayload("t1", { a: 1 }, ["k1"]);
		expect(await verifyPayload("t1", token, ["k1"])).toEqual({ a: 1 });
	});

	it("still accepts tokens signed with a rotated-out key", async () => {
		const token = await signPayload("t1", { a: 1 }, ["old"]);
		expect(await verifyPayload("t1", token, ["new", "old"])).toEqual({ a: 1 });
	});

	it("rejects a tampered body, a wrong key and a wrong prefix", async () => {
		const token = await signPayload("t1", { a: 1 }, ["k1"]);
		const [prefix, , signature] = token.split(".");
		const forged = `${prefix}.${toBase64Url(new TextEncoder().encode('{"a":2}'))}.${signature}`;
		expect(await verifyPayload("t1", forged, ["k1"])).toBeNull();
		expect(await verifyPayload("t1", token, ["k2"])).toBeNull();
		expect(await verifyPayload("t2", token, ["k1"])).toBeNull();
		expect(await verifyPayload("t1", "garbage", ["k1"])).toBeNull();
	});
});

describe("helpers", () => {
	it("computes the RFC 7636 S256 example", async () => {
		// RFC 7636 附录 B 的例子。
		expect(
			await sha256Base64Url("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
		).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
	});

	it("compares strings", () => {
		expect(timingSafeEqual("abc", "abc")).toBe(true);
		expect(timingSafeEqual("abc", "abd")).toBe(false);
		expect(timingSafeEqual("abc", "abcd")).toBe(false);
	});
});
