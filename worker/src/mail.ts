import PostalMime from "postal-mime";

import { isIssuedLocalPart, normalizeLocalPart } from "./address.ts";
import type { Message, MessageSummary } from "./contract.ts";

// 单封邮件原文的上限。Email Routing 本身允许 25 MB；agent 收的是验证码和登录链接，用不到这么大。
export const MAX_RAW_BYTES = 5 * 1024 * 1024;

type MessageRow = {
	id: string;
	address: string;
	from_addr: string;
	from_name: string;
	subject: string;
	received_at: number;
};

export function toSummary(row: MessageRow, domain: string): MessageSummary {
	return {
		id: row.id,
		to: `${row.address}@${domain}`,
		from_addr: row.from_addr,
		from_name: row.from_name,
		subject: row.subject,
		received_at: row.received_at,
	};
}

/**
 * 收一封邮件：原文进 R2，元数据进 D1，然后通知正在等这个地址的连接。
 * 先写 R2 再写 D1：列表里出现的邮件一定打得开；D1 失败时把刚写的原文删掉再抛出，
 * 让 Email Routing 通知发件方重试，不能悄悄丢信。
 */
export async function receiveEmail(
	message: ForwardableEmailMessage,
	env: Pick<Env, "MAIL" | "R2" | "ADDR_SECRET">,
	notify: (address: string) => Promise<unknown>,
): Promise<"stored" | "dropped"> {
	if (message.rawSize > MAX_RAW_BYTES) {
		message.setReject("Message too large (max 5 MB)");
		return "dropped";
	}
	const address = normalizeLocalPart(message.to);
	// 不是我们发出去的地址：直接丢弃，不写任何东西。
	if (!(await isIssuedLocalPart(env.ADDR_SECRET, address))) {
		return "dropped";
	}

	const raw = await new Response(message.raw).arrayBuffer();
	let fromName = "";
	let fromAddr = message.from;
	let subject = "";
	try {
		const parsed = await PostalMime.parse(raw);
		fromName = parsed.from?.name ?? "";
		fromAddr = parsed.from?.address || message.from;
		subject = parsed.subject ?? "";
	} catch {
		// 解析不了的邮件也照样收下：原文还在，读的时候再试。
	}

	const id = crypto.randomUUID();
	await env.R2.put(id, raw, {
		httpMetadata: { contentType: "message/rfc822" },
	});
	try {
		await env.MAIL.prepare(
			"INSERT INTO messages (id, address, from_addr, from_name, subject, received_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
			.bind(id, address, fromAddr, fromName, subject, Date.now())
			.run();
	} catch (error) {
		await env.R2.delete(id).catch(() => {});
		throw error;
	}
	await notify(address);
	return "stored";
}

export async function listMessages(
	env: Pick<Env, "MAIL">,
	address: string,
	options: { since?: number; limit?: number } = {},
): Promise<MessageRow[]> {
	const { results } = await env.MAIL.prepare(
		"SELECT id, address, from_addr, from_name, subject, received_at FROM messages WHERE address = ? AND received_at > ? ORDER BY received_at DESC LIMIT ?",
	)
		.bind(address, options.since ?? 0, Math.min(options.limit ?? 50, 100))
		.all<MessageRow>();
	return results;
}

export async function findMessage(
	env: Pick<Env, "MAIL">,
	id: string,
): Promise<MessageRow | null> {
	return env.MAIL.prepare(
		"SELECT id, address, from_addr, from_name, subject, received_at FROM messages WHERE id = ?",
	)
		.bind(id)
		.first<MessageRow>();
}

/** 从 R2 读原文并解析出正文。原文不在了（以后加了生命周期规则）就只返回元数据。 */
export async function readMessage(
	env: Pick<Env, "R2">,
	row: MessageRow,
	domain: string,
): Promise<Message> {
	const summary = toSummary(row, domain);
	const object = await env.R2.get(row.id);
	if (!object) {
		return { ...summary, text: null, html: null };
	}
	try {
		const parsed = await PostalMime.parse(await object.arrayBuffer());
		return { ...summary, text: parsed.text ?? null, html: parsed.html ?? null };
	} catch {
		return { ...summary, text: null, html: null };
	}
}

export async function deleteMessage(
	env: Pick<Env, "MAIL" | "R2">,
	id: string,
): Promise<void> {
	await env.MAIL.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
	await env.R2.delete(id);
}
