import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";

import { deliver, freshUserId, ORIGIN, tokenFor } from "../helpers.ts";

type ToolResult = {
	content: { type: string; text: string }[];
	isError?: boolean;
};

async function connect(token: string): Promise<Client> {
	const client = new Client({ name: "smails-e2e", version: "0.0.0" });
	await client.connect(
		new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
			requestInit: { headers: { Authorization: `Bearer ${token}` } },
		}),
	);
	return client;
}

async function call(
	client: Client,
	name: string,
	args: Record<string, unknown> = {},
) {
	const result = (await client.callTool({
		name,
		arguments: args,
	})) as ToolResult;
	return {
		text: result.content.map((part) => part.text).join("\n"),
		isError: result.isError,
	};
}

describe("remote MCP", () => {
	it("challenges unauthenticated clients toward the MCP resource metadata", async () => {
		const response = await fetch(`${ORIGIN}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {},
			}),
		});
		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain(
			`${ORIGIN}/.well-known/oauth-protected-resource/mcp`,
		);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});

	it("only accepts tokens issued for the MCP resource", async () => {
		const token = await tokenFor(freshUserId(), { aud: `${ORIGIN}/api` });
		await expect(connect(token)).rejects.toThrow();
	});

	it("runs the create → wait → read flow over the official SDK client", async () => {
		const client = await connect(
			await tokenFor(freshUserId(), { aud: `${ORIGIN}/mcp` }),
		);
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name).toSorted()).toEqual([
			"create_mailbox",
			"delete_message",
			"list_mailboxes",
			"list_messages",
			"read_message",
			"wait_for_message",
			"whoami",
		]);

		const created = await call(client, "create_mailbox");
		const address = /([a-z]+-[a-z]+-[0-9a-z]{8}@smails\.dev)/.exec(
			created.text,
		)?.[1];
		expect(address).toBeTruthy();

		const waiting = call(client, "wait_for_message", {
			address,
			timeout_seconds: 20,
		});
		await new Promise((resolve) => setTimeout(resolve, 500));
		await deliver(address!, {
			subject: "Confirm your email",
			text: "Your code is 314159.",
		});
		const waited = await waiting;
		expect(waited.text).toContain("Subject: Confirm your email");
		expect(waited.text).toContain("314159");

		const listed = await call(client, "list_messages", { address });
		const id = listed.text.split(" | ")[0]!;
		expect((await call(client, "read_message", { id })).text).toContain(
			"314159",
		);
		await client.close();
	});

	it("reports business errors as tool errors", async () => {
		const client = await connect(
			await tokenFor(freshUserId(), { aud: `${ORIGIN}/mcp` }),
		);
		const result = await call(client, "list_messages", {
			address: "nobody-here-00000000@smails.dev",
		});
		expect(result.isError).toBe(true);
		expect(result.text).toContain("No such mailbox");
		await client.close();
	});
});
