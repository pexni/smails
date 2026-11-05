import { generateLocalPart, normalizeLocalPart } from "./address.ts";
import type { Mailbox } from "./contract.ts";
import { HttpError } from "./http.ts";
import { planOf, utcDay } from "./plans.ts";

type MailboxRow = {
	address: string;
	user_id: number;
	created_at: number;
	expires_at: number;
};

export function toMailbox(row: MailboxRow, domain: string): Mailbox {
	return {
		address: `${row.address}@${domain}`,
		created_at: row.created_at,
		expires_at: row.expires_at,
	};
}

/**
 * 创建邮箱：先在今天的用量上 +1（超过档位上限就不加，直接返回 429），再写邮箱。
 * 地址撞了（概率极低）就换一个再试。
 */
export async function createMailbox(
	env: Pick<Env, "CORE" | "ADDR_SECRET">,
	userId: number,
	planName: string,
	now = Date.now(),
): Promise<MailboxRow> {
	const plan = planOf(planName);
	const { day, resetsAt } = utcDay(now);
	const counted = await env.CORE.prepare(
		`INSERT INTO usage (user_id, day, mailboxes) VALUES (?1, ?2, 1)
		 ON CONFLICT (user_id, day) DO UPDATE SET mailboxes = mailboxes + 1 WHERE mailboxes < ?3
		 RETURNING mailboxes`,
	)
		.bind(userId, day, plan.mailboxesPerDay)
		.first<{ mailboxes: number }>();
	if (!counted) {
		throw new HttpError(
			429,
			"quota_exceeded",
			`Daily limit reached: ${plan.mailboxesPerDay} mailboxes per day. Resets at ${new Date(resetsAt).toISOString()}.`,
			{ "Retry-After": String(Math.ceil((resetsAt - now) / 1000)) },
		);
	}

	// 3 个候选地址，一条语句插入第一个没被占用的：不用循环重试，也只有一次往返。
	// 地址空间约 2.4×10^10，3 个同时撞上的概率可以忽略。
	const candidates = await Promise.all(
		[0, 1, 2].map(() => generateLocalPart(env.ADDR_SECRET)),
	);
	const expiresAt = now + plan.mailboxTtlMs;
	const inserted = await env.CORE.prepare(
		`INSERT INTO mailboxes (address, user_id, created_at, expires_at)
		 SELECT column1, ?4, ?5, ?6 FROM (VALUES (?1), (?2), (?3))
		 WHERE NOT EXISTS (SELECT 1 FROM mailboxes WHERE address = column1)
		 LIMIT 1
		 RETURNING address`,
	)
		.bind(...candidates, userId, now, expiresAt)
		.first<{ address: string }>();
	if (!inserted) {
		throw new HttpError(
			503,
			"try_again",
			"Could not allocate an address. Try again.",
		);
	}
	return {
		address: inserted.address,
		user_id: userId,
		created_at: now,
		expires_at: expiresAt,
	};
}

export async function listMailboxes(
	env: Pick<Env, "CORE">,
	userId: number,
	now = Date.now(),
): Promise<MailboxRow[]> {
	const { results } = await env.CORE.prepare(
		"SELECT address, user_id, created_at, expires_at FROM mailboxes WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 100",
	)
		.bind(userId, now)
		.all<MailboxRow>();
	return results;
}

/**
 * 邮箱必须属于令牌里的用户、并且没有过期。别人的邮箱和不存在的邮箱一律回答 404，
 * 不让人借此探测哪些地址存在。
 */
export async function requireMailbox(
	env: Pick<Env, "CORE">,
	userId: number,
	address: string,
	now = Date.now(),
): Promise<MailboxRow> {
	const row = await env.CORE.prepare(
		"SELECT address, user_id, created_at, expires_at FROM mailboxes WHERE address = ?",
	)
		.bind(normalizeLocalPart(address))
		.first<MailboxRow>();
	if (!row || row.user_id !== userId || row.expires_at <= now) {
		throw new HttpError(
			404,
			"not_found",
			"No such mailbox (or it has expired).",
		);
	}
	return row;
}

/** 删除邮箱：只是让它立刻过期。邮件不删，过期后谁都读不到。 */
export async function expireMailbox(
	env: Pick<Env, "CORE">,
	row: MailboxRow,
	now = Date.now(),
): Promise<void> {
	await env.CORE.prepare(
		"UPDATE mailboxes SET expires_at = ? WHERE address = ?",
	)
		.bind(now, row.address)
		.run();
}

export async function usageToday(
	env: Pick<Env, "CORE">,
	userId: number,
	now = Date.now(),
): Promise<number> {
	const row = await env.CORE.prepare(
		"SELECT mailboxes FROM usage WHERE user_id = ? AND day = ?",
	)
		.bind(userId, utcDay(now).day)
		.first<{ mailboxes: number }>();
	return row?.mailboxes ?? 0;
}
