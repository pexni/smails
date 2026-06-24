import { DurableObject } from "cloudflare:workers";
import PostalMime from "postal-mime";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Row = Record<string, SqlStorageValue>;

export class AppError extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

export class Mailbox extends DurableObject<Env> {
	private token: string = "";

	get address(): string {
		return this.ctx.id.name!;
	}

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS messages (
					id          TEXT PRIMARY KEY,
					from_addr   TEXT NOT NULL,
					from_name   TEXT NOT NULL,
					subject     TEXT NOT NULL,
					preview     TEXT NOT NULL,
					raw         TEXT NOT NULL,
					received_at INTEGER NOT NULL,
					read        INTEGER NOT NULL DEFAULT 0
				)
			`);
			const stored = await this.ctx.storage.get<string>("token");
			if (stored) {
				this.token = stored;
			}
		});
	}

	private auth(token: string): void {
		if (!this.token || !token) {
			throw new AppError(401, "Unauthorized");
		}
		const a = new TextEncoder().encode(this.token);
		const b = new TextEncoder().encode(token);
		if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
			throw new AppError(401, "Unauthorized");
		}
	}

	private async touchActivity(): Promise<void> {
		await this.ctx.storage.setAlarm(Date.now() + SEVEN_DAYS_MS);
	}

	async init(token: string, domain: string): Promise<{ address: string; token: string }> {
		if (this.token) {
			throw new AppError(409, "Mailbox already exists");
		}
		await this.ctx.storage.put("token", token);
		await this.ctx.storage.put("domain", domain);
		this.token = token;
		await this.touchActivity();
		return { address: `${this.address}@${domain}`, token };
	}

	async listMessages(token: string): Promise<Row[]> {
		this.auth(token);
		await this.touchActivity();
		return this.ctx.storage.sql.exec<Row>(
			"SELECT id, from_addr, from_name, subject, preview, received_at, read FROM messages ORDER BY received_at DESC LIMIT 100"
		).toArray();
	}

	async getMessage(token: string, id: string): Promise<Record<string, unknown>> {
		this.auth(token);
		await this.touchActivity();
		this.ctx.storage.sql.exec("UPDATE messages SET read = 1 WHERE id = ?", id);
		const rows = this.ctx.storage.sql.exec<{ raw: string } & Row>(
			"SELECT * FROM messages WHERE id = ?", id
		).toArray();
		if (rows.length === 0) {
			throw new AppError(404, "Message not found");
		}
		const row = rows[0];
		const rawBytes = Uint8Array.from(atob(row.raw as string), (c) => c.charCodeAt(0));
		const parsed = await PostalMime.parse(rawBytes);
		return {
			id: row.id,
			from_addr: row.from_addr,
			from_name: row.from_name,
			subject: row.subject,
			received_at: row.received_at,
			read: row.read,
			html: parsed.html || null,
			text: parsed.text || null,
			attachments: parsed.attachments,
		};
	}

	async deleteMessage(token: string, id: string): Promise<void> {
		this.auth(token);
		await this.touchActivity();
		this.ctx.storage.sql.exec("DELETE FROM messages WHERE id = ?", id);
	}

	async receiveEmail(fromAddr: string, fromName: string, subject: string, preview: string, raw: string): Promise<void> {
		if (!this.token) return;
		const id = crypto.randomUUID();
		this.ctx.storage.sql.exec(
			"INSERT INTO messages (id, from_addr, from_name, subject, preview, raw, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			id, fromAddr, fromName, subject, preview, raw, Date.now(),
		);
		this.broadcastNewEmail(id);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const token = url.searchParams.get("token");
		if (!token) {
			return new Response("Unauthorized", { status: 401 });
		}
		try {
			this.auth(token);
		} catch {
			return new Response("Unauthorized", { status: 401 });
		}
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		await this.touchActivity();
		return new Response(null, { status: 101, webSocket: client });
	}

	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
		if (message === "ping") {
			ws.send("pong");
		}
	}

	webSocketError(ws: WebSocket): void {
		ws.close();
	}

	private broadcastNewEmail(id: string): void {
		const msg = JSON.stringify({ type: "new_email", id });
		for (const ws of this.ctx.getWebSockets()) {
			ws.send(msg);
		}
	}

	async alarm(): Promise<void> {
		for (const ws of this.ctx.getWebSockets()) {
			ws.close(1000, "Mailbox expired");
		}
		await this.ctx.storage.deleteAll();
		this.token = "";
	}
}
