import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import * as z from "zod";

import { formatForAgent } from "./format.ts";
import { errorResponse, HttpError } from "./http.ts";
import { findMessage, listMessages, readMessage, toSummary } from "./mail.ts";
import {
	createMailbox,
	listMailboxes,
	requireMailbox,
	toMailbox,
	usageToday,
} from "./mailboxes.ts";
import { withCors } from "./oauth/index.ts";
import { planOf } from "./plans.ts";
import { type AccessClaims, authenticate } from "./tokens.ts";
import { HUB_NAME, MAX_WAIT_MS, waitForMessage } from "./wait.ts";

// 远程 MCP：POST /mcp，Streamable HTTP，无状态。每个请求新建一个 McpServer 和传输层，
// 不开会话（不发 Mcp-Session-Id），只返回 JSON，不用 Durable Object。
// 本地 MCP（CLI 的 `smails mcp`）只是把 stdio 转发到这里，所以工具只在这里写一份。

const VERSION = "1.0.0";

const INSTRUCTIONS = `smails gives you disposable email inboxes for sign-ups, verification codes and magic links.
Typical flow: create_mailbox → use the address on the website → wait_for_message (it blocks until mail arrives and returns the full body) → read the code or link from it.
Mailboxes expire after 7 days. Mail is receive-only.`;

type Text = { content: { type: "text"; text: string }[]; isError?: boolean };

function text(value: string): Text {
	return { content: [{ type: "text", text: value }] };
}

/** 工具里的业务错误（邮箱不存在、配额用完）作为工具结果返回，让 agent 看到原因，而不是协议错误。 */
async function run(action: () => Promise<Text>): Promise<Text> {
	try {
		return await action();
	} catch (error) {
		if (error instanceof HttpError) {
			return { ...text(error.message), isError: true };
		}
		throw error;
	}
}

function buildServer(
	env: Env,
	ctx: ExecutionContext,
	claims: AccessClaims,
): McpServer {
	const domain = env.SITE_DOMAIN;
	const server = new McpServer(
		{ name: "smails", version: VERSION },
		{
			instructions: INSTRUCTIONS,
			jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
		},
	);

	server.registerTool(
		"create_mailbox",
		{
			title: "Create mailbox",
			description:
				"Create a new disposable email address. Returns the address; use it right away, then call wait_for_message.",
			annotations: { readOnlyHint: false, openWorldHint: false },
		},
		() =>
			run(async () => {
				const mailbox = toMailbox(
					await createMailbox(env, claims.sub, claims.plan),
					domain,
				);
				return text(
					`Created ${mailbox.address} (expires ${new Date(mailbox.expires_at).toISOString()}).`,
				);
			}),
	);

	server.registerTool(
		"list_mailboxes",
		{
			title: "List mailboxes",
			description:
				"List your mailboxes that have not expired yet, newest first.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		() =>
			run(async () => {
				const rows = await listMailboxes(env, claims.sub);
				if (rows.length === 0) {
					return text("You have no active mailboxes. Call create_mailbox.");
				}
				return text(
					rows
						.map((row) => {
							const mailbox = toMailbox(row, domain);
							return `${mailbox.address} (expires ${new Date(mailbox.expires_at).toISOString()})`;
						})
						.join("\n"),
				);
			}),
	);

	server.registerTool(
		"list_messages",
		{
			title: "List messages",
			description:
				"List messages received by a mailbox, newest first (sender, subject, time, id). Use read_message for the body.",
			inputSchema: {
				address: z
					.string()
					.describe(
						"The mailbox address, e.g. brave-otter-k3j9x2m8@smails.dev",
					),
			},
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		({ address }) =>
			run(async () => {
				const mailbox = await requireMailbox(env, claims.sub, address);
				const rows = await listMessages(env, mailbox.address);
				if (rows.length === 0) {
					return text(
						"No messages yet. Call wait_for_message to wait for one.",
					);
				}
				return text(
					rows
						.map((row) => {
							const m = toSummary(row, domain);
							return `${m.id} | ${new Date(m.received_at).toISOString()} | From: ${m.from_addr} | Subject: ${m.subject}`;
						})
						.join("\n"),
				);
			}),
	);

	server.registerTool(
		"read_message",
		{
			title: "Read message",
			description: "Read one message in full: headers and body as plain text.",
			inputSchema: { id: z.string().describe("Message id from list_messages") },
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		({ id }) =>
			run(async () => {
				const row = await findMessage(env, id);
				if (!row) {
					throw new HttpError(404, "not_found", "No such message.");
				}
				await requireMailbox(env, claims.sub, row.address).catch(() => {
					throw new HttpError(404, "not_found", "No such message.");
				});
				return text(formatForAgent(await readMessage(env, row, domain)));
			}),
	);

	server.registerTool(
		"wait_for_message",
		{
			title: "Wait for message",
			description: `Block until a new message arrives in the mailbox (up to ${MAX_WAIT_MS / 1000} seconds), then return it in full. Optional filters match the sender or subject (case-insensitive substring). If nothing arrives in time, call it again.`,
			inputSchema: {
				address: z.string().describe("The mailbox address"),
				from: z
					.string()
					.optional()
					.describe("Only messages whose sender contains this text"),
				subject: z
					.string()
					.optional()
					.describe("Only messages whose subject contains this text"),
				since: z
					.number()
					.optional()
					.describe(
						"Only messages received after this time (ms since epoch). Defaults to now; pass 0 to include mail that already arrived.",
					),
				timeout_seconds: z
					.number()
					.int()
					.min(1)
					.max(MAX_WAIT_MS / 1000)
					.optional()
					.describe(`How long to wait, at most ${MAX_WAIT_MS / 1000}`),
			},
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		({ address, from, subject, since, timeout_seconds: timeout }) =>
			run(async () => {
				const mailbox = await requireMailbox(env, claims.sub, address);
				const row = await waitForMessage(
					env,
					ctx.exports.InboxHub.getByName(HUB_NAME),
					mailbox.address,
					{
						since: since ?? Date.now(),
						timeoutMs: (timeout ?? MAX_WAIT_MS / 1000) * 1000,
						filter: { from, subject },
					},
				);
				if (!row) {
					return text(
						"No new message yet. Call wait_for_message again to keep waiting.",
					);
				}
				return text(formatForAgent(await readMessage(env, row, domain)));
			}),
	);

	server.registerTool(
		"delete_message",
		{
			title: "Delete message",
			description: "Delete one message.",
			inputSchema: { id: z.string().describe("Message id") },
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				openWorldHint: false,
			},
		},
		({ id }) =>
			run(async () => {
				const row = await findMessage(env, id);
				if (!row) {
					throw new HttpError(404, "not_found", "No such message.");
				}
				await requireMailbox(env, claims.sub, row.address).catch(() => {
					throw new HttpError(404, "not_found", "No such message.");
				});
				await env.MAIL.prepare("DELETE FROM messages WHERE id = ?")
					.bind(id)
					.run();
				await env.R2.delete(id);
				return text(`Deleted ${id}.`);
			}),
	);

	server.registerTool(
		"whoami",
		{
			title: "Who am I",
			description:
				"Show the signed-in account, plan and today's mailbox quota.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		() =>
			run(async () => {
				const user = await env.CORE.prepare(
					"SELECT github_login FROM users WHERE id = ?",
				)
					.bind(claims.sub)
					.first<{ github_login: string }>();
				const plan = planOf(claims.plan);
				return text(
					`Signed in as ${user?.github_login ?? "unknown"} (plan: ${claims.plan}). Mailboxes today: ${await usageToday(env, claims.sub)}/${plan.mailboxesPerDay}.`,
				);
			}),
	);

	return server;
}

export async function handleMcp(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	origin: string,
): Promise<Response> {
	if (request.method === "OPTIONS") {
		return withCors(new Response(null, { status: 204 }));
	}
	// 有人在浏览器里打开 https://smails.dev/mcp：带去文档页。MCP 客户端不会要 text/html。
	if (
		request.method === "GET" &&
		request.headers.get("Accept")?.includes("text/html")
	) {
		return new Response(null, {
			status: 301,
			headers: { Location: "/docs/mcp" },
		});
	}
	let claims: AccessClaims;
	try {
		claims = await authenticate(request, env, {
			audiences: [`${origin}/mcp`],
			resourceMetadata: `${origin}/.well-known/oauth-protected-resource/mcp`,
		});
	} catch (error) {
		// 401 也要带 CORS 头：浏览器里的客户端要读 WWW-Authenticate 才找得到授权服务器。
		if (error instanceof HttpError) {
			return withCors(errorResponse(error));
		}
		throw error;
	}
	const server = buildServer(env, ctx, claims);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	try {
		return withCors(await transport.handleRequest(request));
	} finally {
		ctx.waitUntil(server.close());
	}
}
