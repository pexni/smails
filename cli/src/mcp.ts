import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SmailsAPI } from "./api.js";
import { loadConfig, saveConfig } from "./config.js";

export async function runMCP() {
	const server = new McpServer({
		name: "smails",
		version: "0.0.2",
	});

	function getAPI(): SmailsAPI {
		const config = loadConfig();
		if (!config) {
			throw new Error("No mailbox configured. Use create_mailbox first.");
		}
		return new SmailsAPI(config.token);
	}

	server.tool("create_mailbox", "Create a new temporary email mailbox. If a mailbox already exists, pass force=true to replace it.", {
		domain: z.string().optional().describe("Domain to use for the mailbox"),
		force: z.boolean().optional().describe("Set to true to replace an existing mailbox"),
	}, async ({ domain, force }) => {
		const existing = loadConfig();
		if (existing && !force) {
			return { content: [{ type: "text", text: `A mailbox already exists: ${existing.address}. Pass force=true to replace it.` }] };
		}
		const api = new SmailsAPI();
		const result = await api.createMailbox(domain);
		saveConfig({ address: result.address, token: result.token });
		return { content: [{ type: "text", text: `Mailbox created: ${result.address}` }] };
	});

	server.tool("list_messages", "List messages in the current mailbox", {}, async () => {
		const api = getAPI();
		const messages = await api.listMessages();
		if (messages.length === 0) {
			return { content: [{ type: "text", text: "Inbox is empty." }] };
		}
		const text = messages.map((m) => {
			const read = m.read ? "read" : "unread";
			return `[${read}] ${m.id} | From: ${m.from_addr} | Subject: ${m.subject} | Preview: ${m.preview}`;
		}).join("\n");
		return { content: [{ type: "text", text }] };
	});

	server.tool("read_message", "Read a specific message", { id: z.string().describe("Message ID") }, async ({ id }) => {
		const api = getAPI();
		const msg = await api.getMessage(id);
		const text = `From: ${msg.from_name} <${msg.from_addr}>
Subject: ${msg.subject}
Date: ${new Date(msg.received_at).toLocaleString()}
---
${msg.text || msg.html || "(empty)"}`;
		return { content: [{ type: "text", text }] };
	});

	server.tool("delete_message", "Delete a specific message", { id: z.string().describe("Message ID") }, async ({ id }) => {
		const api = getAPI();
		await api.deleteMessage(id);
		return { content: [{ type: "text", text: `Message ${id} deleted.` }] };
	});

	server.tool("get_address", "Get the current mailbox address", {}, async () => {
		const config = loadConfig();
		if (!config) {
			return { content: [{ type: "text", text: "No mailbox configured. Use create_mailbox first." }] };
		}
		return { content: [{ type: "text", text: config.address }] };
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);
}
