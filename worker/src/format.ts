// 邮件给 agent 看的纯文本形式。Worker（远程 MCP）和 CLI 共用：这个文件除了 contract.ts 不依赖任何模块。

import type { Message } from "./contract.ts";

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

/** 只有 html 的邮件转成纯文本给 agent 读：去掉样式和脚本，链接保留成“文字 (网址)”。 */
export function htmlToText(html: string): string {
	return html
		.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
		.replace(
			/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
			(_, href, label) => {
				const text = String(label)
					.replace(/<[^>]+>/g, "")
					.trim();
				return text && text !== href ? `${text} (${href})` : String(href);
			},
		)
		.replace(/<(br|\/p|\/div|\/tr|\/h[1-6]|\/li)\b[^>]*>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
			if (code.startsWith("#x") || code.startsWith("#X")) {
				return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
			}
			if (code.startsWith("#")) {
				return String.fromCodePoint(Number(code.slice(1)));
			}
			return ENTITIES[code.toLowerCase()] ?? entity;
		})
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** 一封邮件给 agent 看的样子：头部几行 + 正文。 */
export function formatForAgent(message: Message): string {
	const body =
		message.text?.trim() ||
		(message.html ? htmlToText(message.html) : "") ||
		"(empty)";
	const from = message.from_name
		? `${message.from_name} <${message.from_addr}>`
		: message.from_addr;
	return [
		`ID: ${message.id}`,
		`To: ${message.to}`,
		`From: ${from}`,
		`Subject: ${message.subject || "(no subject)"}`,
		`Date: ${new Date(message.received_at).toISOString()}`,
		"",
		body,
	].join("\n");
}
