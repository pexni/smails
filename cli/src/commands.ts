import { spawn } from "node:child_process";

import type {
	Mailbox,
	Me,
	Message,
	MessageSummary,
	WaitResult,
} from "../../worker/src/contract.ts";
import { formatForAgent } from "../../worker/src/format.ts";
import { finishDeviceLogin, logout, startDeviceLogin } from "./auth.ts";
import { api, serverUrl } from "./client.ts";
import { loadCredentials, updateCredentials } from "./credentials.ts";

// 远程一次最多等 50 秒；CLI 的 wait 在这个基础上自动续等，直到用户给的总时长。
const SERVER_WAIT_SECONDS = 50;
const FULL_ID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Flags = {
	json: boolean;
	values: Map<string, string>;
	positionals: string[];
};

function print(flags: Flags, human: string, data: unknown): void {
	console.log(flags.json ? JSON.stringify(data, null, 2) : human);
}

/** 尽量帮用户打开浏览器；打不开也没关系，链接已经打印出来了。 */
function openBrowser(url: string): void {
	if (!process.stdout.isTTY || process.env.SMAILS_NO_BROWSER) {
		return;
	}
	const [command, args] =
		process.platform === "darwin"
			? ["open", [url]]
			: process.platform === "win32"
				? ["cmd", ["/c", "start", "", url]]
				: ["xdg-open", [url]];
	try {
		spawn(command, args, { stdio: "ignore", detached: true })
			.on("error", () => {})
			.unref();
	} catch {
		// 没有图形界面（SSH、容器）
	}
}

function currentAddress(server: string, flags: Flags): string {
	const address =
		flags.positionals[0] ?? loadCredentials(server)?.current_address;
	if (!address) {
		throw new Error(
			"No mailbox given. Run `smails create` first, or pass an address.",
		);
	}
	return address;
}

async function resolveMessageId(
	server: string,
	idOrPrefix: string,
	flags: Flags,
): Promise<string> {
	if (FULL_ID.test(idOrPrefix)) {
		return idOrPrefix;
	}
	const address =
		flags.values.get("mailbox") ?? loadCredentials(server)?.current_address;
	if (!address) {
		throw new Error(
			"Pass the full message id (short prefixes work for the current mailbox).",
		);
	}
	const messages = await api<MessageSummary[]>(
		server,
		`/api/mailboxes/${encodeURIComponent(address)}/messages`,
	);
	const matches = messages.filter((m) => m.id.startsWith(idOrPrefix));
	if (matches.length !== 1) {
		throw new Error(
			matches.length === 0
				? `No message starting with "${idOrPrefix}" in ${address}.`
				: `"${idOrPrefix}" is ambiguous (${matches.length} matches). Use more characters.`,
		);
	}
	return matches[0]!.id;
}

export async function login(): Promise<void> {
	const server = serverUrl();
	const start = await startDeviceLogin(server);
	console.log(
		`Open this link to sign in with GitHub:\n\n  ${start.verification_uri_complete}\n`,
	);
	console.log(
		`Or go to ${start.verification_uri} and enter the code ${start.user_code}.`,
	);
	console.log("Waiting for you to confirm in the browser…");
	openBrowser(start.verification_uri_complete);
	const credentials = await finishDeviceLogin(server, start);
	console.log(`Signed in as ${credentials.login}.`);
}

export async function signOut(): Promise<void> {
	console.log(
		(await logout(serverUrl())) ? "Signed out." : "You were not signed in.",
	);
}

export async function whoami(flags: Flags): Promise<void> {
	const me = await api<Me>(serverUrl(), "/api/me");
	print(
		flags,
		`Signed in as ${me.user.github_login}${me.user.email ? ` <${me.user.email}>` : ""} (plan: ${me.plan}). Mailboxes today: ${me.quota.mailboxes_today}/${me.quota.mailboxes_per_day}.`,
		me,
	);
}

export async function create(flags: Flags): Promise<void> {
	const server = serverUrl();
	const mailbox = await api<Mailbox>(server, "/api/mailboxes", {
		method: "POST",
	});
	updateCredentials(server, { current_address: mailbox.address });
	print(flags, mailbox.address, mailbox);
}

export async function list(flags: Flags): Promise<void> {
	const mailboxes = await api<Mailbox[]>(serverUrl(), "/api/mailboxes");
	print(
		flags,
		mailboxes.length === 0
			? "No active mailboxes. Run `smails create`."
			: mailboxes
					.map(
						(m) =>
							`${m.address}  expires ${new Date(m.expires_at).toLocaleString()}`,
					)
					.join("\n"),
		mailboxes,
	);
}

export async function inbox(flags: Flags): Promise<void> {
	const server = serverUrl();
	const address = currentAddress(server, flags);
	const messages = await api<MessageSummary[]>(
		server,
		`/api/mailboxes/${encodeURIComponent(address)}/messages`,
	);
	print(
		flags,
		messages.length === 0
			? `${address}: no messages yet. Run \`smails wait\` to wait for one.`
			: messages
					.map(
						(m) =>
							`${m.id.slice(0, 8)}  ${new Date(m.received_at).toLocaleString()}  ${m.from_addr.slice(0, 32).padEnd(32)}  ${m.subject}`,
					)
					.join("\n"),
		messages,
	);
}

export async function read(flags: Flags): Promise<void> {
	const server = serverUrl();
	const idOrPrefix = flags.positionals[0];
	if (!idOrPrefix) {
		throw new Error("Usage: smails read <id>");
	}
	const id = await resolveMessageId(server, idOrPrefix, flags);
	const message = await api<Message>(server, `/api/messages/${id}`);
	print(flags, formatForAgent(message), message);
}

export async function remove(flags: Flags): Promise<void> {
	const server = serverUrl();
	const idOrPrefix = flags.positionals[0];
	if (!idOrPrefix) {
		throw new Error("Usage: smails delete <id>");
	}
	const id = await resolveMessageId(server, idOrPrefix, flags);
	await api(server, `/api/messages/${id}`, { method: "DELETE" });
	print(flags, `Deleted ${id.slice(0, 8)}.`, { deleted: id });
}

/** 等一封新邮件，等到就打印全文。服务器一次最多等 50 秒，这里自动续等到 --timeout。 */
export async function wait(flags: Flags): Promise<void> {
	const server = serverUrl();
	const address = currentAddress(server, flags);
	const total = Number(flags.values.get("timeout") ?? "120");
	if (!Number.isFinite(total) || total <= 0) {
		throw new Error("--timeout must be a positive number of seconds.");
	}
	const since = Number(flags.values.get("since") ?? Date.now());
	const deadline = Date.now() + total * 1000;
	const query = new URLSearchParams({ since: String(since) });
	for (const key of ["from", "subject"]) {
		const value = flags.values.get(key);
		if (value) {
			query.set(key, value);
		}
	}
	if (!flags.json) {
		console.error(`Waiting for mail to ${address}…`);
	}
	while (Date.now() < deadline) {
		const seconds = Math.max(
			1,
			Math.min(SERVER_WAIT_SECONDS, Math.ceil((deadline - Date.now()) / 1000)),
		);
		query.set("timeout", String(seconds));
		// oxlint-disable-next-line no-await-in-loop -- 一次没等到就接着等
		const result = await api<WaitResult>(
			server,
			`/api/mailboxes/${encodeURIComponent(address)}/wait?${query}`,
			{ timeoutMs: (seconds + 15) * 1000 },
		);
		if (result.message) {
			print(flags, formatForAgent(result.message), result.message);
			return;
		}
	}
	process.exitCode = 2;
	print(flags, `No message arrived within ${total} seconds.`, {
		message: null,
	});
}
