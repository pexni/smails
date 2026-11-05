import type { Me, WaitResult } from "./contract.ts";
import { HttpError, json } from "./http.ts";
import { legacyApi } from "./legacy.ts";
import {
	deleteMessage,
	findMessage,
	listMessages,
	readMessage,
	toSummary,
} from "./mail.ts";
import {
	createMailbox,
	expireMailbox,
	listMailboxes,
	requireMailbox,
	toMailbox,
	usageToday,
} from "./mailboxes.ts";
import { planOf, utcDay } from "./plans.ts";
import { type AccessClaims, authenticate, originOf } from "./tokens.ts";
import { HUB_NAME, MAX_WAIT_MS, waitForMessage } from "./wait.ts";

function intParam(url: URL, name: string, fallback: number): number {
	const value = url.searchParams.get(name);
	if (value === null || value === "") {
		return fallback;
	}
	const number = Number(value);
	if (!Number.isFinite(number) || number < 0) {
		throw new HttpError(
			400,
			"invalid_request",
			`\`${name}\` must be a non-negative number.`,
		);
	}
	return Math.floor(number);
}

async function me(env: Env, claims: AccessClaims): Promise<Me> {
	const user = await env.CORE.prepare(
		"SELECT id, github_login FROM users WHERE id = ?",
	)
		.bind(claims.sub)
		.first<{ id: number; github_login: string }>();
	if (!user) {
		throw new HttpError(401, "invalid_token", "This account no longer exists.");
	}
	const plan = planOf(claims.plan);
	return {
		user,
		plan: claims.plan,
		quota: {
			mailboxes_per_day: plan.mailboxesPerDay,
			mailboxes_today: await usageToday(env, claims.sub),
			resets_at: utcDay().resetsAt,
		},
	};
}

/** `/api/*`：给 CLI、本地 MCP 和直接调用的脚本用。所有接口都要访问令牌。 */
export async function handleApi(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);
	const { pathname } = url;
	const method = request.method;

	// 旧的匿名接口。
	if (
		pathname === "/api/mailbox" ||
		pathname.startsWith("/api/mailbox/") ||
		pathname === "/api/domains"
	) {
		legacyApi();
	}

	const origin = originOf(request, env.SITE_DOMAIN);
	const claims = await authenticate(request, env, {
		audiences: [`${origin}/api`, `${origin}/mcp`],
		resourceMetadata: `${origin}/.well-known/oauth-protected-resource`,
	});
	const domain = env.SITE_DOMAIN;

	if (pathname === "/api/me" && method === "GET") {
		return json(await me(env, claims));
	}

	if (pathname === "/api/mailboxes") {
		if (method === "POST") {
			return json(
				toMailbox(await createMailbox(env, claims.sub, claims.plan), domain),
				201,
			);
		}
		if (method === "GET") {
			return json(
				(await listMailboxes(env, claims.sub)).map((row) =>
					toMailbox(row, domain),
				),
			);
		}
	}

	const mailboxMatch = /^\/api\/mailboxes\/([^/]+)(\/messages|\/wait)?$/.exec(
		pathname,
	);
	if (mailboxMatch) {
		const mailbox = await requireMailbox(
			env,
			claims.sub,
			decodeURIComponent(mailboxMatch[1]!),
		);
		const sub = mailboxMatch[2];
		if (!sub && method === "DELETE") {
			await expireMailbox(env, mailbox);
			return new Response(null, { status: 204 });
		}
		if (sub === "/messages" && method === "GET") {
			const rows = await listMessages(env, mailbox.address, {
				since: intParam(url, "since", 0),
				limit: intParam(url, "limit", 50),
			});
			return json(rows.map((row) => toSummary(row, domain)));
		}
		if (sub === "/wait" && method === "GET") {
			const row = await waitForMessage(
				env,
				ctx.exports.InboxHub.getByName(HUB_NAME),
				mailbox.address,
				{
					since: intParam(url, "since", Date.now()),
					timeoutMs: intParam(url, "timeout", MAX_WAIT_MS / 1000) * 1000,
					filter: {
						from: url.searchParams.get("from") ?? undefined,
						subject: url.searchParams.get("subject") ?? undefined,
					},
					signal: request.signal,
				},
			);
			const result: WaitResult = {
				message: row ? await readMessage(env, row, domain) : null,
			};
			return json(result);
		}
	}

	const messageMatch = /^\/api\/messages\/([0-9a-f-]{36})$/.exec(pathname);
	if (messageMatch) {
		const row = await findMessage(env, messageMatch[1]!);
		// 邮件所在的邮箱必须属于当前用户；不属于就当作不存在。
		if (!row) {
			throw new HttpError(404, "not_found", "No such message.");
		}
		await requireMailbox(env, claims.sub, row.address).catch(() => {
			throw new HttpError(404, "not_found", "No such message.");
		});
		if (method === "GET") {
			return json(await readMessage(env, row, domain));
		}
		if (method === "DELETE") {
			await deleteMessage(env, row.id);
			return new Response(null, { status: 204 });
		}
	}

	throw new HttpError(404, "not_found", "No such endpoint.");
}
