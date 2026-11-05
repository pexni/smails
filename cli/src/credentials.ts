import {
	chmodSync,
	closeSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// 登录凭证存在 ~/.config/smails/credentials.json（遵守 XDG_CONFIG_HOME），权限 600。
// 按服务器地址分开存：本地开发（http://localhost:8792）和线上互不影响。

export type Credentials = {
	access_token: string;
	refresh_token: string;
	/** 访问令牌过期的时间（毫秒）。 */
	expires_at: number;
	login: string;
	/** 最近一次创建的邮箱：inbox / wait 不写地址时用它。 */
	current_address?: string;
};

type Store = { version: 1; servers: Record<string, Credentials> };

export function configDir(): string {
	return join(
		process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
		"smails",
	);
}

function storePath(): string {
	return join(configDir(), "credentials.json");
}

function readStore(): Store {
	try {
		const store = JSON.parse(readFileSync(storePath(), "utf8")) as Store;
		if (
			store.version === 1 &&
			store.servers &&
			typeof store.servers === "object"
		) {
			return store;
		}
	} catch {
		// 没有文件或者坏了：当作没登录
	}
	return { version: 1, servers: {} };
}

function writeStore(store: Store): void {
	mkdirSync(configDir(), { recursive: true, mode: 0o700 });
	// 先写临时文件再改名：写到一半被打断也不会留下半个文件。
	const temp = `${storePath()}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
	chmodSync(temp, 0o600);
	renameSync(temp, storePath());
}

export function loadCredentials(server: string): Credentials | null {
	return readStore().servers[server] ?? null;
}

export function saveCredentials(
	server: string,
	credentials: Credentials,
): void {
	const store = readStore();
	store.servers[server] = credentials;
	writeStore(store);
}

export function updateCredentials(
	server: string,
	patch: Partial<Credentials>,
): void {
	const store = readStore();
	const current = store.servers[server];
	if (current) {
		store.servers[server] = { ...current, ...patch };
		writeStore(store);
	}
}

export function deleteCredentials(server: string): void {
	const store = readStore();
	if (store.servers[server]) {
		delete store.servers[server];
		writeStore(store);
	}
}

const LOCK_STALE_MS = 15_000;

/**
 * 跨进程的锁：刷新令牌时用。刷新令牌每次使用都会轮换，CLI 和正在运行的本地 MCP 要是同时拿旧令牌去刷新，
 * 服务器会当成令牌泄露、作废整条链，用户就被登出了。拿到锁以后要重新读一次凭证：别的进程可能已经刷新过了。
 */
export async function withLock<T>(action: () => Promise<T>): Promise<T> {
	mkdirSync(configDir(), { recursive: true, mode: 0o700 });
	const lockPath = join(configDir(), "credentials.lock");
	const deadline = Date.now() + LOCK_STALE_MS;
	while (true) {
		try {
			closeSync(openSync(lockPath, "wx", 0o600));
			break;
		} catch {
			try {
				// 上一个进程崩溃了留下的锁：超过 15 秒就当它无效。
				if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
					unlinkSync(lockPath);
					continue;
				}
			} catch {
				continue;
			}
			if (Date.now() > deadline) {
				throw new Error(
					"Timed out waiting for another smails process to refresh credentials.",
				);
			}
			// oxlint-disable-next-line no-await-in-loop -- 等别的进程放开锁
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	try {
		return await action();
	} finally {
		try {
			unlinkSync(lockPath);
		} catch {
			// 已经被当作过期锁清掉了
		}
	}
}
