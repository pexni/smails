// 只在本地开发时用：线上的库还没建时，`cf d1 migrations apply` 拿不到数据库 id，
// 所以本地由 Worker 在第一个请求时自己把 migrations/ 跑一遍。生产构建里
// import.meta.env.DEV 是 false，调用它的地方整段会被去掉；线上照常用 cf 执行迁移。

const CORE = import.meta.glob<string>("../migrations/core/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});
const MAIL = import.meta.glob<string>("../migrations/mail/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** 去掉 `--` 注释后按分号切成一条条语句（迁移文件里不写字符串里的分号）。 */
function statements(sql: string): string[] {
	return sql
		.split("\n")
		.map((line) => line.replace(/--.*$/, ""))
		.join("\n")
		.split(";")
		.map((statement) => statement.trim())
		.filter(Boolean);
}

async function migrate(
	db: D1Database,
	files: Record<string, string>,
): Promise<void> {
	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY)",
		)
		.run();
	const applied = new Set(
		(
			await db
				.prepare("SELECT name FROM _dev_migrations")
				.all<{ name: string }>()
		).results.map((row) => row.name),
	);
	for (const [path, sql] of Object.entries(files).toSorted(([a], [b]) =>
		a.localeCompare(b),
	)) {
		const name = path.split("/").at(-1)!;
		if (applied.has(name)) {
			continue;
		}
		// 迁移必须按文件顺序一个个执行。
		// oxlint-disable-next-line no-await-in-loop
		await db.batch([
			...statements(sql).map((statement) => db.prepare(statement)),
			db.prepare("INSERT INTO _dev_migrations (name) VALUES (?)").bind(name),
		]);
	}
}

let done: Promise<void> | null = null;

export function migrateLocally(env: Pick<Env, "CORE" | "MAIL">): Promise<void> {
	done ??= Promise.all([migrate(env.CORE, CORE), migrate(env.MAIL, MAIL)]).then(
		() => undefined,
		(error: unknown) => {
			done = null;
			throw error;
		},
	);
	return done;
}
