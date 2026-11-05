import { describe, expect, it } from "vitest";

import { formatForAgent, htmlToText } from "../../src/format.ts";

describe("htmlToText", () => {
	it("keeps text and links, drops styles and scripts", () => {
		const html = `<html><head><style>p{color:red}</style></head><body>
			<p>Hi&nbsp;there,</p><p>Your code is <b>482913</b>.</p>
			<a href="https://example.com/verify?t=abc">Verify email</a>
			<script>alert(1)</script></body></html>`;
		const text = htmlToText(html);
		expect(text).toContain("Hi there,");
		expect(text).toContain("Your code is 482913.");
		expect(text).toContain("Verify email (https://example.com/verify?t=abc)");
		expect(text).not.toContain("alert");
		expect(text).not.toContain("color:red");
	});
});

describe("formatForAgent", () => {
	it("prefers the text part and falls back to the html part", () => {
		const base = {
			id: "1",
			to: "a@smails.dev",
			from_addr: "x@example.com",
			from_name: "X",
			subject: "S",
			received_at: 0,
		};
		expect(
			formatForAgent({ ...base, text: "plain", html: "<p>html</p>" }),
		).toContain("plain");
		expect(
			formatForAgent({ ...base, text: null, html: "<p>only html</p>" }),
		).toContain("only html");
		expect(formatForAgent({ ...base, text: null, html: null })).toContain(
			"(empty)",
		);
	});
});
