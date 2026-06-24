import { randomName } from "@scaleway/random-name";
import { Hono } from "hono";
import PostalMime from "postal-mime";
import { Mailbox, AppError } from "./mailbox";

export { Mailbox };

const app = new Hono<{ Bindings: Env }>();

function generateAddress(): string {
	const name = randomName();
	const bytes = new Uint8Array(3);
	crypto.getRandomValues(bytes);
	const suffix = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 6);
	return `${name}-${suffix}`;
}

function generateSecret(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getDomains(env: Env): string[] {
	return (env.DOMAINS || "smails.dev").split(",").map((d) => d.trim());
}

function parseToken(authHeader: string | null): { address: string; token: string } | null {
	if (!authHeader?.startsWith("Bearer ")) return null;
	const token = authHeader.slice(7);
	const dotIndex = token.indexOf(".");
	if (dotIndex === -1) return null;
	const address = token.substring(0, dotIndex);
	const secret = token.substring(dotIndex + 1);
	if (!address || !/^[a-z0-9-]+$/.test(address)) return null;
	if (!secret || secret.length !== 32 || !/^[0-9a-f]+$/.test(secret)) return null;
	return { address, token };
}

function toBase64(bytes: Uint8Array): string {
	const chunkSize = 8192;
	let binary = "";
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
		binary += String.fromCharCode(...slice);
	}
	return btoa(binary);
}

app.get("/api/domains", (c) => {
	return c.json(getDomains(c.env));
});

app.post("/api/mailbox", async (c) => {
	const body = await c.req.json<{ domain?: string }>().catch(() => ({ domain: undefined }));
	const domains = getDomains(c.env);
	const domain = body.domain && domains.includes(body.domain) ? body.domain : domains[0];
	const address = generateAddress();
	const secret = generateSecret();
	const token = `${address}.${secret}`;
	const stub = c.env.MAILBOX.getByName(address);
	const result = await stub.init(token, domain);
	return c.json(result, 201);
});

app.get("/api/mailbox/connect", async (c) => {
	if (c.req.header("Upgrade") !== "websocket") {
		return c.json({ error: "Expected WebSocket" }, 426);
	}
	const tokenParam = c.req.query("token");
	if (!tokenParam) return c.json({ error: "Unauthorized" }, 401);
	const parsed = parseToken(`Bearer ${tokenParam}`);
	if (!parsed) return c.json({ error: "Invalid token" }, 401);
	const stub = c.env.MAILBOX.getByName(parsed.address);
	return stub.fetch(c.req.raw);
});

const authed = new Hono<{ Bindings: Env; Variables: { parsed: { address: string; token: string } } }>();

authed.use(async (c, next) => {
	const parsed = parseToken(c.req.header("Authorization") ?? null);
	if (!parsed) return c.json({ error: "Unauthorized" }, 401);
	c.set("parsed", parsed);
	await next();
});

authed.get("/messages", async (c) => {
	const { address, token } = c.var.parsed;
	const stub = c.env.MAILBOX.getByName(address);
	return c.json(await stub.listMessages(token));
});

authed.get("/messages/:id", async (c) => {
	const { address, token } = c.var.parsed;
	const stub = c.env.MAILBOX.getByName(address);
	return c.json(await stub.getMessage(token, c.req.param("id")));
});

authed.delete("/messages/:id", async (c) => {
	const { address, token } = c.var.parsed;
	const stub = c.env.MAILBOX.getByName(address);
	await stub.deleteMessage(token, c.req.param("id"));
	return c.json({ ok: true });
});

app.route("/api/mailbox", authed);

app.onError((err, c) => {
	if (err instanceof AppError) {
		return c.json({ error: err.message }, err.status as 400);
	}
	return c.json({ error: "Internal error" }, 500);
});

export default {
	fetch: app.fetch,

	async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
		if (message.rawSize > 2 * 1024 * 1024) {
			message.setReject("Message too large (max 2MB)");
			return;
		}

		const address = message.to.split("@")[0];
		const stub = env.MAILBOX.getByName(address);

		const rawBytes = new Uint8Array(await new Response(message.raw).arrayBuffer());
		const raw = toBase64(rawBytes);
		const parsed = await PostalMime.parse(rawBytes);

		await stub.receiveEmail(
			message.from,
			parsed.from?.name || message.from,
			parsed.subject || "(no subject)",
			(parsed.text || "").substring(0, 200).replace(/\n/g, " "),
			raw,
		);
	},
} satisfies ExportedHandler<Env>;
