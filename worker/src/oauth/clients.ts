import { randomToken } from "../crypto.ts";
import { OAuthError } from "./errors.ts";

// OAuth 客户端。三种来源：
// - 一方客户端：我们自己的 CLI 和本地 MCP，只走设备授权，没有 redirect_uri。写死在代码里。
// - CIMD（Client ID Metadata Document）：client_id 本身是一个 https URL，我们去拉它的元数据。
//   MCP 规范推荐的方式。拉到的结果缓存在 D1，24 小时后重新拉。
// - DCR（动态注册，RFC 7591）：规范里已标为弃用，为了兼容老客户端仍然支持。
// 只支持公开客户端（token_endpoint_auth_method = none），靠 PKCE 保证安全。

export type Client = {
	client_id: string;
	kind: "first_party" | "cimd" | "dcr";
	name: string;
	redirect_uris: string[];
};

export const CLI_CLIENT_ID = "smails-cli";

const FIRST_PARTY: Record<string, Client> = {
	[CLI_CLIENT_ID]: {
		client_id: CLI_CLIENT_ID,
		kind: "first_party",
		name: "smails CLI",
		redirect_uris: [],
	},
};

const CIMD_REFRESH_MS = 24 * 60 * 60 * 1000;
const CIMD_TIMEOUT_MS = 3_000;
const CIMD_MAX_BYTES = 16 * 1024;
const MAX_REDIRECT_URIS = 10;
const MAX_NAME_LENGTH = 100;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
// 原生应用可以用自己的私有 scheme（cursor://、vscode:// 之类，RFC 8252）；这些是绝对不行的。
const FORBIDDEN_SCHEMES = new Set([
	"javascript:",
	"data:",
	"file:",
	"vbscript:",
	"about:",
	"blob:",
	"filesystem:",
]);

function isLoopback(url: URL): boolean {
	return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/** 注册时检查一个 redirect_uri 能不能用：https、本机回环的 http、或者原生应用的私有 scheme。 */
export function isAcceptableRedirectUri(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.hash || FORBIDDEN_SCHEMES.has(url.protocol)) {
		return false;
	}
	if (url.protocol === "https:") {
		return true;
	}
	if (url.protocol === "http:") {
		return isLoopback(url);
	}
	// 私有 scheme 至少要像 com.example.app: 或 cursor: 这样，不接受单字母（像 Windows 盘符）。
	return /^[a-z][a-z0-9+.-]+:$/.test(url.protocol);
}

/**
 * 授权请求里的 redirect_uri 是否和注册的一致：字符串完全相等。
 * 唯一的例外是本机回环地址：端口可以不同（RFC 8252 §7.3，原生应用每次随机挑一个空闲端口）。
 */
export function redirectUriMatches(
	registered: string[],
	requested: string,
): boolean {
	if (registered.includes(requested)) {
		return true;
	}
	let wanted: URL;
	try {
		wanted = new URL(requested);
	} catch {
		return false;
	}
	if (!isLoopback(wanted)) {
		return false;
	}
	return registered.some((value) => {
		try {
			const url = new URL(value);
			return (
				isLoopback(url) &&
				url.hostname === wanted.hostname &&
				url.pathname === wanted.pathname &&
				url.search === wanted.search
			);
		} catch {
			return false;
		}
	});
}

/** client_id 是不是一个 CIMD 的 URL：https、带路径、不是 IP 字面量、不是本机。 */
export function isCimdClientId(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	return (
		url.protocol === "https:" &&
		url.pathname !== "/" &&
		!url.hash &&
		!url.username &&
		!url.password &&
		!LOOPBACK_HOSTS.has(url.hostname) &&
		!/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) &&
		!url.hostname.startsWith("[")
	);
}

function cleanName(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim()
		? value.trim().slice(0, MAX_NAME_LENGTH)
		: fallback;
}

function parseRedirectUris(value: unknown): string[] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > MAX_REDIRECT_URIS ||
		!value.every(
			(uri) => typeof uri === "string" && isAcceptableRedirectUri(uri),
		)
	) {
		throw new OAuthError(
			400,
			"invalid_redirect_uri",
			"redirect_uris must list 1–10 https, loopback or private-scheme URIs.",
		);
	}
	return value as string[];
}

/** 拉取并校验 CIMD。限制协议、超时、大小，不跟随跳转：防止被拿来让我们去请求任意地址。 */
export async function fetchClientMetadata(
	clientId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<Client> {
	let response: Response;
	try {
		response = await fetchImpl(clientId, {
			headers: { Accept: "application/json" },
			redirect: "manual",
			signal: AbortSignal.timeout(CIMD_TIMEOUT_MS),
		});
	} catch {
		throw new OAuthError(
			400,
			"invalid_client",
			"Could not fetch the client metadata document.",
		);
	}
	if (response.status !== 200) {
		throw new OAuthError(
			400,
			"invalid_client",
			`The client metadata document answered ${response.status}.`,
		);
	}
	const declared = Number(response.headers.get("Content-Length") ?? "0");
	if (declared > CIMD_MAX_BYTES) {
		throw new OAuthError(
			400,
			"invalid_client",
			"The client metadata document is too large.",
		);
	}
	const text = await response.text();
	if (text.length > CIMD_MAX_BYTES) {
		throw new OAuthError(
			400,
			"invalid_client",
			"The client metadata document is too large.",
		);
	}
	let metadata: Record<string, unknown>;
	try {
		metadata = JSON.parse(text) as Record<string, unknown>;
	} catch {
		throw new OAuthError(
			400,
			"invalid_client",
			"The client metadata document is not JSON.",
		);
	}
	if (metadata.client_id !== clientId) {
		throw new OAuthError(
			400,
			"invalid_client",
			"The client metadata document's client_id must equal its URL.",
		);
	}
	const method = metadata.token_endpoint_auth_method ?? "none";
	if (method !== "none") {
		throw new OAuthError(
			400,
			"invalid_client",
			"Only public clients (token_endpoint_auth_method none) are supported.",
		);
	}
	return {
		client_id: clientId,
		kind: "cimd",
		name: cleanName(metadata.client_name, new URL(clientId).hostname),
		redirect_uris: parseRedirectUris(metadata.redirect_uris),
	};
}

type ClientRow = {
	client_id: string;
	kind: Client["kind"];
	name: string;
	redirect_uris: string;
	fetched_at: number | null;
};

function fromRow(row: ClientRow): Client {
	return {
		client_id: row.client_id,
		kind: row.kind,
		name: row.name,
		redirect_uris: JSON.parse(row.redirect_uris) as string[],
	};
}

export async function resolveClient(
	env: Pick<Env, "CORE">,
	clientId: string,
	options: { now?: number; fetchImpl?: typeof fetch } = {},
): Promise<Client> {
	const now = options.now ?? Date.now();
	const firstParty = FIRST_PARTY[clientId];
	if (firstParty) {
		return firstParty;
	}
	const row = await env.CORE.prepare(
		"SELECT client_id, kind, name, redirect_uris, fetched_at FROM oauth_clients WHERE client_id = ?",
	)
		.bind(clientId)
		.first<ClientRow>();
	if (isCimdClientId(clientId)) {
		if (row && row.fetched_at && now - row.fetched_at < CIMD_REFRESH_MS) {
			return fromRow(row);
		}
		const client = await fetchClientMetadata(clientId, options.fetchImpl);
		await env.CORE.prepare(
			`INSERT INTO oauth_clients (client_id, kind, name, redirect_uris, fetched_at, created_at)
			 VALUES (?1, 'cimd', ?2, ?3, ?4, ?4)
			 ON CONFLICT (client_id) DO UPDATE SET name = ?2, redirect_uris = ?3, fetched_at = ?4`,
		)
			.bind(clientId, client.name, JSON.stringify(client.redirect_uris), now)
			.run();
		return client;
	}
	if (row?.kind === "dcr") {
		return fromRow(row);
	}
	throw new OAuthError(400, "invalid_client", "Unknown client_id.");
}

/** POST /register（RFC 7591）：只接受公开客户端。 */
export async function registerClient(
	env: Pick<Env, "CORE">,
	body: Record<string, unknown>,
	now = Date.now(),
): Promise<Record<string, unknown>> {
	const method = body.token_endpoint_auth_method ?? "none";
	if (method !== "none") {
		throw new OAuthError(
			400,
			"invalid_client_metadata",
			"Only public clients (token_endpoint_auth_method none) are supported.",
		);
	}
	const grantTypes = (body.grant_types ?? [
		"authorization_code",
		"refresh_token",
	]) as unknown;
	if (
		!Array.isArray(grantTypes) ||
		!grantTypes.every(
			(type) => type === "authorization_code" || type === "refresh_token",
		)
	) {
		throw new OAuthError(
			400,
			"invalid_client_metadata",
			"grant_types may only contain authorization_code and refresh_token.",
		);
	}
	const redirectUris = parseRedirectUris(body.redirect_uris);
	const clientId = `dcr_${randomToken(18)}`;
	const name = cleanName(body.client_name, "MCP client");
	await env.CORE.prepare(
		"INSERT INTO oauth_clients (client_id, kind, name, redirect_uris, created_at) VALUES (?, 'dcr', ?, ?, ?)",
	)
		.bind(clientId, name, JSON.stringify(redirectUris), now)
		.run();
	return {
		client_id: clientId,
		client_id_issued_at: Math.floor(now / 1000),
		client_name: name,
		redirect_uris: redirectUris,
		token_endpoint_auth_method: "none",
		grant_types: grantTypes,
		response_types: ["code"],
	};
}
