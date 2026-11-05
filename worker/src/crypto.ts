// 签名、哈希、随机数的小工具。只用 WebCrypto：Workers 和 Node 都有，测试可以直接在 Node 里跑。

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(value)) {
		return null;
	}
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	try {
		const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	} catch {
		return null;
	}
}

export function encodeText(value: string): Uint8Array<ArrayBuffer> {
	return encoder.encode(value) as Uint8Array<ArrayBuffer>;
}

/** n 字节的密码学随机数，base64url 编码。 */
export function randomToken(bytes = 32): string {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** PKCE 的 S256：base64url(SHA-256(verifier))。 */
export async function sha256Base64Url(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return toBase64Url(new Uint8Array(digest));
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
	let key = keyCache.get(secret);
	if (!key) {
		key = crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign", "verify"],
		);
		keyCache.set(secret, key);
	}
	return key;
}

export async function hmac(
	secret: string,
	message: string,
): Promise<Uint8Array<ArrayBuffer>> {
	const signature = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(secret),
		encoder.encode(message),
	);
	return new Uint8Array(signature);
}

export async function hmacVerify(
	secret: string,
	message: string,
	signature: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
	return crypto.subtle.verify(
		"HMAC",
		await hmacKey(secret),
		signature,
		encoder.encode(message),
	);
}

/** 长度不同直接返回 false；长度相同时按常数时间比较。 */
export function timingSafeEqual(a: string, b: string): boolean {
	const left = encoder.encode(a);
	const right = encoder.encode(b);
	if (left.byteLength !== right.byteLength) {
		return false;
	}
	let diff = 0;
	for (let index = 0; index < left.byteLength; index++) {
		diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return diff === 0;
}

/** 逗号分隔的密钥列表：最左边的用来签名，其余的只用来验证。 */
export function parseSecrets(
	value: string | undefined,
	name: string,
): string[] {
	const secrets = (value ?? "")
		.split(",")
		.map((secret) => secret.trim())
		.filter(Boolean);
	if (secrets.length === 0) {
		throw new Error(
			`Missing ${name}. Set it in worker/.env (see .env.example).`,
		);
	}
	return secrets;
}

/**
 * 带签名的小数据：`base64url(JSON).base64url(HMAC)`，前面加一个类型前缀。
 * 访问令牌、会话 cookie、OAuth 进行中的请求都用它。验证时每个密钥都试一遍（轮换期间旧密钥签的也认）。
 */
export async function signPayload(
	prefix: string,
	payload: unknown,
	secrets: string[],
): Promise<string> {
	const body = `${prefix}.${toBase64Url(encodeText(JSON.stringify(payload)))}`;
	const signature = toBase64Url(await hmac(secrets[0]!, body));
	return `${body}.${signature}`;
}

export async function verifyPayload(
	prefix: string,
	token: string,
	secrets: string[],
): Promise<unknown> {
	const parts = token.split(".");
	if (parts.length !== 3 || parts[0] !== prefix) {
		return null;
	}
	const signature = fromBase64Url(parts[2]!);
	if (!signature) {
		return null;
	}
	const body = `${parts[0]}.${parts[1]}`;
	// 轮换期间旧密钥签的也要认：每个密钥都验一遍。
	const results = await Promise.all(
		secrets.map((secret) => hmacVerify(secret, body, signature)),
	);
	if (!results.includes(true)) {
		return null;
	}
	const json = fromBase64Url(parts[1]!);
	if (!json) {
		return null;
	}
	try {
		return JSON.parse(new TextDecoder().decode(json)) as unknown;
	} catch {
		return null;
	}
}
