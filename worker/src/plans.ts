// 档位和配额。收费以后只在这里加档位。

export type Plan = {
	/** 每个用户每天（UTC）最多创建几个邮箱。 */
	mailboxesPerDay: number;
	/** 邮箱创建后多久过期。过期后读不到它的邮件，但邮件本身不删。 */
	mailboxTtlMs: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS: Record<string, Plan> = {
	free: { mailboxesPerDay: 20, mailboxTtlMs: 7 * DAY_MS },
};

export function planOf(name: string): Plan {
	return PLANS[name] ?? PLANS.free!;
}

/** UTC 日期 'YYYY-MM-DD' 和这一天结束的时间。 */
export function utcDay(now = Date.now()): { day: string; resetsAt: number } {
	const day = new Date(now).toISOString().slice(0, 10);
	return { day, resetsAt: Date.parse(`${day}T00:00:00Z`) + DAY_MS };
}
