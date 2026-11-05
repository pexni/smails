import { DurableObject } from "cloudflare:workers";

import { HttpError } from "./http.ts";

/**
 * 旧版每个邮箱一个的 Durable Object，只留下清理数据的部分。
 *
 * 旧接口已经停用（见 legacyApi），不会再有新的访问。每个旧对象上还挂着一个 alarm（最后一次
 * 活动后 7 天），到点时把自己的数据全部删掉。7 天后旧数据就自然清空了，不用跑一次性的批量删除。
 * 清空以后把 cloudflare.config.ts 里的 Mailbox 改成 state: "deleted"，这个类就可以删掉了。
 */
export class Mailbox extends DurableObject<Env> {
	async fetch(): Promise<Response> {
		return new Response("Gone", { status: 410 });
	}

	// 休眠中的旧连接（旧网页还开着）发来消息时，直接关掉它。
	webSocketMessage(socket: WebSocket): void {
		socket.close(1000, "smails has moved: see https://smails.dev");
	}

	webSocketClose(socket: WebSocket, code: number, reason: string): void {
		try {
			socket.close(code, reason);
		} catch {
			// 已经关闭
		}
	}

	async alarm(): Promise<void> {
		for (const socket of this.ctx.getWebSockets()) {
			socket.close(1000, "Mailbox expired");
		}
		await this.ctx.storage.deleteAll();
	}
}

/** 旧的匿名接口一律返回 410，说清楚怎么迁移。那个批量注册脚本就是在这里被挡掉的。 */
export function legacyApi(): never {
	throw new HttpError(
		410,
		"gone",
		"The anonymous API has been retired. smails now requires sign-in: run `npx @smails/cli login`, or connect the remote MCP server at https://smails.dev/mcp. Docs: https://smails.dev",
	);
}
