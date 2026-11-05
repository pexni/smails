import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Browser, deliver, ORIGIN } from "../helpers.ts";

// 用真正构建出来的 CLI（cli/dist/index.js）对着本地 Worker 跑。
const CLI_DIR = fileURLToPath(new URL("../../../cli", import.meta.url).href);
const BIN = join(CLI_DIR, "dist/index.js");

let configHome: string;

function env(): NodeJS.ProcessEnv {
	return {
		...process.env,
		SMAILS_URL: ORIGIN,
		XDG_CONFIG_HOME: configHome,
		SMAILS_NO_BROWSER: "1",
	};
}

function smails(...args: string[]): { stdout: string; status: number } {
	try {
		return {
			stdout: execFileSync("node", [BIN, ...args], {
				env: env(),
				encoding: "utf8",
			}),
			status: 0,
		};
	} catch (error) {
		const failed = error as {
			stdout?: string;
			stderr?: string;
			status?: number;
		};
		return {
			stdout: `${failed.stdout ?? ""}${failed.stderr ?? ""}`,
			status: failed.status ?? 1,
		};
	}
}

/** 浏览器那一边：打开 CLI 给的链接，登录，点确认。 */
async function confirmInBrowser(link: string, login: string): Promise<void> {
	const code = new URL(link).searchParams.get("code")!;
	const browser = new Browser();
	await browser.signIn(login);
	const response = await browser.post("/api/web/device", {
		user_code: code,
		approve: true,
	});
	expect(response.status).toBe(200);
}

/** 跑 `smails login`，从输出里拿到链接，在“浏览器”里确认，等它完成。 */
async function signIn(login: string): Promise<string> {
	const child = spawn("node", [BIN, "login"], { env: env() });
	let output = "";
	const linkSeen = new Promise<string>((resolve) => {
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
			const match = /(http\S+\/device\?code=\S+)/.exec(output);
			if (match) {
				resolve(match[1]!);
			}
		});
	});
	await confirmInBrowser(await linkSeen, login);
	const status = await new Promise<number | null>((resolve) =>
		child.on("close", resolve),
	);
	expect(status).toBe(0);
	return output;
}

beforeAll(() => {
	execFileSync("pnpm", ["exec", "tsdown"], { cwd: CLI_DIR, stdio: "ignore" });
	configHome = mkdtempSync(join(tmpdir(), "smails-cli-"));
});

afterAll(() => {
	rmSync(configHome, { recursive: true, force: true });
});

describe("CLI", () => {
	it("asks to sign in first", () => {
		const result = smails("create");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("Not signed in");
	});

	it("signs in with device login and stores credentials privately", async () => {
		const output = await signIn("clitester");
		expect(output).toContain("Signed in as clitester");
		const file = join(configHome, "smails/credentials.json");
		expect(statSync(file).mode & 0o777).toBe(0o600);
		expect(JSON.parse(readFileSync(file, "utf8")).servers[ORIGIN].login).toBe(
			"clitester",
		);
		expect(smails("whoami").stdout).toContain("Signed in as clitester");
	});

	it("creates a mailbox, waits for mail and reads it", async () => {
		const created = smails("create");
		expect(created.status).toBe(0);
		const address = created.stdout.trim();
		expect(address).toMatch(/@smails\.dev$/);

		const waiting = new Promise<string>((resolve) => {
			const child = spawn(
				"node",
				[BIN, "wait", "--subject", "code", "--timeout", "20"],
				{
					env: env(),
				},
			);
			let out = "";
			child.stdout.on("data", (chunk: Buffer) => {
				out += chunk.toString();
			});
			child.on("close", () => resolve(out));
		});
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		await deliver(address, {
			subject: "Your sign-in code",
			text: "Use 271828 to sign in.",
		});
		const printed = await waiting;
		expect(printed).toContain("Subject: Your sign-in code");
		expect(printed).toContain("271828");

		const listed = smails("inbox");
		expect(listed.stdout).toContain("Your sign-in code");
		const prefix = listed.stdout.trim().split(/\s+/)[0]!;
		expect(smails("read", prefix).stdout).toContain("271828");

		const json = JSON.parse(smails("inbox", "--json").stdout) as {
			subject: string;
		}[];
		expect(json[0]!.subject).toBe("Your sign-in code");
	});

	it("exits with status 2 when nothing arrives in time", () => {
		const result = smails("wait", "--timeout", "1");
		expect(result.status).toBe(2);
		expect(result.stdout).toContain("No message arrived");
	});
});

/** 很小的 MCP stdio 客户端：一行一条 JSON-RPC。 */
class StdioClient {
	private readonly child: ChildProcess;
	private nextId = 1;
	private readonly waiting = new Map<
		number,
		(message: Record<string, unknown>) => void
	>();
	readonly notifications: string[] = [];

	constructor() {
		this.child = spawn("node", [BIN, "mcp"], { env: env() });
		createInterface({ input: this.child.stdout! }).on("line", (line) => {
			const message = JSON.parse(line) as Record<string, unknown>;
			if (typeof message.id === "number") {
				this.waiting.get(message.id)?.(message);
			} else if (typeof message.method === "string") {
				this.notifications.push(message.method);
			}
		});
	}

	request(
		method: string,
		params: Record<string, unknown> = {},
	): Promise<Record<string, any>> {
		const id = this.nextId++;
		this.child.stdin!.write(
			`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
		);
		return new Promise((resolve) => this.waiting.set(id, resolve));
	}

	notify(method: string): void {
		this.child.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
	}

	async initialize(): Promise<Record<string, any>> {
		const answer = await this.request("initialize", {
			protocolVersion: "2025-11-25",
			capabilities: {},
			clientInfo: { name: "e2e", version: "0" },
		});
		this.notify("notifications/initialized");
		return answer;
	}

	async callTool(
		name: string,
		args: Record<string, unknown> = {},
	): Promise<string> {
		const answer = await this.request("tools/call", { name, arguments: args });
		return (answer.result.content as { text: string }[])
			.map((part) => part.text)
			.join("\n");
	}

	close(): void {
		this.child.stdin!.end();
	}
}

describe("local MCP (stdio → remote /mcp)", () => {
	it("offers only login before sign-in, and signs in through it", async () => {
		const signedOut = mkdtempSync(join(tmpdir(), "smails-mcp-"));
		const previous = configHome;
		configHome = signedOut;
		try {
			const client = new StdioClient();
			const init = await client.initialize();
			expect(init.result.serverInfo.name).toBe("smails");
			const tools = await client.request("tools/list");
			expect(
				tools.result.tools.map((tool: { name: string }) => tool.name),
			).toEqual(["login"]);

			const first = await client.callTool("login");
			const link = /(http\S+\/device\?code=[A-Z-]+)/.exec(first)?.[1];
			expect(link).toBeTruthy();
			await confirmInBrowser(link!, "mcplogin");
			// 后台轮询每 5 秒一次；确认后最多再等一轮。
			let after = "";
			for (let i = 0; i < 20 && !after.includes("Signed in"); i++) {
				await new Promise((resolve) => setTimeout(resolve, 500));
				after = await client.callTool("login");
			}
			expect(after).toContain("Signed in as mcplogin");
			expect(client.notifications).toContain(
				"notifications/tools/list_changed",
			);
			client.close();
		} finally {
			configHome = previous;
			rmSync(signedOut, { recursive: true, force: true });
		}
	});

	it("forwards the remote tools once signed in", async () => {
		const client = new StdioClient();
		await client.initialize();
		const tools = await client.request("tools/list");
		const names = tools.result.tools.map((tool: { name: string }) => tool.name);
		expect(names).toContain("wait_for_message");
		expect(names).toContain("login");

		const created = await client.callTool("create_mailbox");
		const address = /([a-z]+-[a-z]+-[0-9a-z]{8}@smails\.dev)/.exec(
			created,
		)?.[1];
		expect(address).toBeTruthy();
		const waiting = client.callTool("wait_for_message", {
			address,
			timeout_seconds: 20,
		});
		await new Promise((resolve) => setTimeout(resolve, 500));
		await deliver(address!, {
			subject: "Magic link",
			text: "https://example.com/login?t=xyz",
		});
		expect(await waiting).toContain("https://example.com/login?t=xyz");
		client.close();
	});
});
