import { createInterface } from "node:readline";

import {
	accessToken,
	finishDeviceLogin,
	NotSignedInError,
	startDeviceLogin,
} from "./auth.ts";
import { serverUrl } from "./client.ts";
import { loadCredentials } from "./credentials.ts";

// 本地 MCP（stdio）：只做转发。客户端发来的每条 JSON-RPC 消息原样转给远程 https://smails.dev/mcp，
// 带上本地保存的令牌；工具都在远程实现，本地和远程的行为保证一致。
// 本地只多实现一个 login 工具：还没登录时，agent 调它拿到确认链接转告用户，用户在网页上点确认即可。
//
// stdio 传输：每行一条 JSON-RPC 消息。stdout 只能写协议消息，日志一律写 stderr。

type JsonRpc = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method?: string;
	params?: Record<string, unknown>;
	result?: unknown;
	error?: { code: number; message: string };
};

const FALLBACK_PROTOCOL = "2025-11-25";

const LOGIN_TOOL = {
	name: "login",
	title: "Sign in to smails",
	description:
		"Sign in to smails with GitHub. The first call returns a link for the user to open and confirm; call login again after they confirm. Only needed once per machine.",
	inputSchema: { type: "object", properties: {} },
	annotations: { readOnlyHint: false, openWorldHint: true },
};

function send(message: JsonRpc): void {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id: JsonRpc["id"], result: unknown): void {
	send({ jsonrpc: "2.0", id: id ?? null, result });
}

function toolText(text: string, isError = false) {
	return {
		content: [{ type: "text", text }],
		...(isError ? { isError: true } : {}),
	};
}

export async function runMcp(version: string): Promise<void> {
	const server = serverUrl();
	let protocolVersion = FALLBACK_PROTOCOL;
	// 进行中的登录：第一次调 login 时开始，后台一直轮询；再调 login 时看结果。
	type PendingLogin = {
		link: string;
		code: string;
		login?: string;
		error?: string;
	};
	let pendingLogin: PendingLogin | null = null;

	async function forward(
		message: JsonRpc,
		retried = false,
	): Promise<JsonRpc | null> {
		const token = await accessToken(server, retried ? { force: true } : {});
		const response = await fetch(`${server}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				Authorization: `Bearer ${token}`,
				"Mcp-Protocol-Version": protocolVersion,
			},
			body: JSON.stringify(message),
			// wait_for_message 在服务器上最多等 50 秒。
			signal: AbortSignal.timeout(90_000),
		});
		if (response.status === 401 && !retried) {
			return forward(message, true);
		}
		if (response.status === 202 || response.status === 204) {
			return null;
		}
		const text = await response.text();
		if (!response.ok && !text.startsWith("{")) {
			throw new Error(`smails answered HTTP ${response.status}`);
		}
		return JSON.parse(text) as JsonRpc;
	}

	async function login(): Promise<ReturnType<typeof toolText>> {
		if (pendingLogin?.login) {
			const name = pendingLogin.login;
			pendingLogin = null;
			return toolText(`Signed in as ${name}. The smails tools are ready.`);
		}
		if (pendingLogin?.error) {
			const error = pendingLogin.error;
			pendingLogin = null;
			return toolText(`${error} Call login again to get a new link.`, true);
		}
		if (pendingLogin) {
			return toolText(
				`Still waiting. Ask the user to open ${pendingLogin.link} (code ${pendingLogin.code}), sign in with GitHub and click Confirm, then call login again.`,
			);
		}
		const existing = loadCredentials(server);
		if (existing) {
			return toolText(`Already signed in as ${existing.login}.`);
		}

		const start = await startDeviceLogin(server);
		const entry: PendingLogin = {
			link: start.verification_uri_complete,
			code: start.user_code,
		};
		pendingLogin = entry;
		void (async () => {
			try {
				entry.login = (await finishDeviceLogin(server, start)).login;
				// 登录后工具列表变了（多了远程的工具）：通知客户端重新取。
				send({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
			} catch (error) {
				entry.error = error instanceof Error ? error.message : String(error);
			}
		})();
		return toolText(
			`To sign in, ask the user to open this link, sign in with GitHub and click Confirm:\n\n${entry.link}\n\n(code ${entry.code}). Then call login again.`,
		);
	}

	async function handle(message: JsonRpc): Promise<void> {
		const { id, method } = message;
		const isRequest = id !== undefined && method !== undefined;
		const signedIn = loadCredentials(server) !== null;

		// 没登录时远程连不上：本地自己回答握手，工具列表里只有 login。
		if (method === "initialize") {
			const requested = message.params?.protocolVersion;
			if (signedIn) {
				try {
					const answer = await forward(message);
					const negotiated = (
						answer?.result as { protocolVersion?: string } | undefined
					)?.protocolVersion;
					if (negotiated) {
						protocolVersion = negotiated;
					}
					if (answer) {
						send(answer);
						return;
					}
				} catch {
					// 远程暂时连不上：下面本地回答，工具调用时再连
				}
			}
			protocolVersion =
				typeof requested === "string" ? requested : FALLBACK_PROTOCOL;
			reply(id, {
				protocolVersion,
				capabilities: { tools: { listChanged: true } },
				serverInfo: { name: "smails", version },
				instructions: "Call the login tool first to sign in to smails.",
			});
			return;
		}
		if (method === "tools/call" && message.params?.name === "login") {
			reply(id, await login());
			return;
		}
		if (method === "tools/list" && !signedIn) {
			reply(id, { tools: [LOGIN_TOOL] });
			return;
		}
		if (method === "ping") {
			reply(id, {});
			return;
		}

		try {
			const answer = await forward(message);
			if (!answer || !isRequest) {
				return;
			}
			if (method === "tools/list" && answer.result) {
				const result = answer.result as { tools?: unknown[] };
				answer.result = {
					...result,
					tools: [...(result.tools ?? []), LOGIN_TOOL],
				};
			}
			send(answer);
		} catch (error) {
			if (!isRequest) {
				return;
			}
			if (error instanceof NotSignedInError) {
				reply(
					id,
					toolText("Not signed in to smails. Call the login tool first.", true),
				);
				return;
			}
			send({
				jsonrpc: "2.0",
				id,
				error: {
					code: -32603,
					message: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	const lines = createInterface({ input: process.stdin });
	const running = new Set<Promise<void>>();
	lines.on("line", (line) => {
		if (!line.trim()) {
			return;
		}
		let message: JsonRpc;
		try {
			message = JSON.parse(line) as JsonRpc;
		} catch {
			send({
				jsonrpc: "2.0",
				id: null,
				error: { code: -32700, message: "Parse error" },
			});
			return;
		}
		// 并发处理：wait_for_message 等着的时候，别的调用不用排队。
		const task = handle(message).catch((error: unknown) => {
			console.error("[smails mcp]", error);
		});
		running.add(task);
		void task.finally(() => running.delete(task));
	});
	await new Promise<void>((resolve) => lines.on("close", resolve));
	await Promise.allSettled(running);
}
