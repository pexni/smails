import type { InboxHub } from "./inbox-hub.ts";
import { findMessage } from "./mail.ts";

function noop(): void {}

/** 所有连接共用的推送中心。以后要分片，只改这一处的取名规则。 */
export const HUB_NAME = "all";

/** 很多 MCP 客户端的工具调用超时是 60 秒，等待最多 50 秒，留出余量。 */
export const MAX_WAIT_MS = 50_000;

export type WaitFilter = {
	from?: string | undefined;
	subject?: string | undefined;
};

type Row = {
	id: string;
	from_addr: string;
	from_name: string;
	subject: string;
	received_at: number;
};

function has(haystack: string, needle?: string): boolean {
	return !needle || haystack.toLowerCase().includes(needle.toLowerCase());
}

function matches(row: Row, filter: WaitFilter): boolean {
	return (
		has(`${row.from_name} ${row.from_addr}`, filter.from) &&
		has(row.subject, filter.subject)
	);
}

async function firstNewMessage(
	env: Pick<Env, "MAIL">,
	address: string,
	since: number,
	filter: WaitFilter,
): Promise<string | null> {
	const { results } = await env.MAIL.prepare(
		"SELECT id, from_addr, from_name, subject, received_at FROM messages WHERE address = ? AND received_at > ? ORDER BY received_at ASC LIMIT 50",
	)
		.bind(address, since)
		.all<Row>();
	return results.find((row) => matches(row, filter))?.id ?? null;
}

/**
 * 等这个地址来一封 received_at > since、并且符合过滤条件的新邮件，返回最早的那一封。
 *
 * 先连上推送中心、再查一次 D1：两步之间到的信不会漏掉。等待期间 Worker 不按时长计费，
 * 推送中心在休眠，所以一次等待只算 1 次 Worker 请求 + 1 次 DO 请求，跟等多久无关。
 */
export async function waitForMessage(
	env: Pick<Env, "MAIL">,
	hub: DurableObjectStub<InboxHub>,
	address: string,
	options: {
		since: number;
		timeoutMs: number;
		filter: WaitFilter;
		signal?: AbortSignal;
	},
) {
	const response = await hub.fetch(
		new Request("https://inbox-hub/connect", {
			headers: { Upgrade: "websocket", "x-inbox-address": address },
		}),
	);
	const socket = response.webSocket;
	if (!socket) {
		throw new Error(`InboxHub refused the connection (${response.status})`);
	}
	socket.accept();

	let wake: () => void = noop;
	// 推送连接断了（推送中心重启之类）就退回每 2 秒查一次，免得空转。
	let closed = false;
	const nextSignal = () =>
		closed
			? new Promise<void>((resolve) => setTimeout(resolve, 2_000))
			: new Promise<void>((resolve) => {
					wake = resolve;
				});
	socket.addEventListener("message", () => wake());
	socket.addEventListener("close", () => {
		closed = true;
		wake();
	});

	const deadline = Date.now() + Math.min(options.timeoutMs, MAX_WAIT_MS);
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		while (true) {
			const pending = nextSignal();
			// 等待循环：每收到一次信号才查一次，必须按顺序。
			// oxlint-disable-next-line no-await-in-loop
			const id = await firstNewMessage(
				env,
				address,
				options.since,
				options.filter,
			);
			if (id) {
				return findMessage(env, id);
			}
			const left = deadline - Date.now();
			if (left <= 0 || options.signal?.aborted) {
				return null;
			}
			// oxlint-disable-next-line no-await-in-loop
			await Promise.race([
				pending,
				new Promise<void>((resolve) => {
					timer = setTimeout(resolve, left);
				}),
			]);
			clearTimeout(timer);
		}
	} finally {
		clearTimeout(timer);
		try {
			socket.close(1000, "done");
		} catch {
			// 已经关闭
		}
	}
}
