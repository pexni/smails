import { randomName } from "@scaleway/random-name";
import { Hono } from "hono";
import PostalMime from "postal-mime";
import { httpStatusForError, Mailbox } from "./mailbox";

export { Mailbox };

const app = new Hono<{ Bindings: Env }>();

// Tag every API response with the current deploy id so the frontend can detect
// when the backend has been updated and prompt the user to refresh.
app.use(async (c, next) => {
  await next();
  c.header("X-Smails-Version", c.env.CF_VERSION.id);
});

function generateAddress(): string {
  const name = randomName();
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 6);
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
  if (secret?.length !== 32 || !/^[0-9a-f]+$/.test(secret)) return null;
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
  const result = await stub.create(token, domain);
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

const authed = new Hono<{
  Bindings: Env;
  Variables: { parsed: { address: string; token: string } };
}>();

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
  const status = httpStatusForError(err);
  if (status !== null) {
    return c.json({ error: err.message }, status as 400);
  }
  return c.json({ error: "Internal error" }, 500);
});

export default {
  fetch: app.fetch,

  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    // Stored base64 inflates the raw by ~4/3; bounce anything that wouldn't fit
    // under the ~2 MB Durable Object SQLite row limit.
    if (message.rawSize > 1.4 * 1024 * 1024) {
      message.setReject("Message too large (max 1.4MB)");
      return;
    }

    const address = message.to.split("@")[0].toLowerCase();
    const stub = env.MAILBOX.getByName(address);

    const rawBytes = new Uint8Array(await new Response(message.raw).arrayBuffer());
    const raw = toBase64(rawBytes);

    // Parse for display fields; if the MIME is malformed, fall back to
    // placeholders so the message is still retained rather than bounced.
    let fromName = message.from;
    let subject = "(no subject)";
    let preview = "";
    try {
      const parsed = await PostalMime.parse(rawBytes);
      fromName = parsed.from?.name || message.from;
      subject = parsed.subject || "(no subject)";
      preview = (parsed.text || "").substring(0, 200).replace(/\n/g, " ");
    } catch {
      // keep placeholders; the raw message is still stored
    }

    try {
      await stub.receiveMessage(message.from, fromName, subject, preview, raw);
    } catch (err) {
      // Storing failed (transient DO error, or the row exceeded SQLite limits).
      // Don't silently accept — surface it so Email Routing reports the failure
      // and the sender retries, instead of the message being lost without a trace.
      console.error("receiveMessage failed", err);
      throw err;
    }
  },
} satisfies ExportedHandler<Env>;
