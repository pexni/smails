// cf 的 D1 命令只认数据库 id，不认名字。id 写在 ../site.config.ts 里，这里取出来再转交给 cf。
//
//   node d1.mjs migrate [cf 的其他参数]   对 core 和 mail 两个库执行还没执行过的迁移
//   node d1.mjs users                    最近注册的 30 个用户
//   node d1.mjs stats                    今天和昨天创建的邮箱数、用户数、收信数
//   node d1.mjs ban <GitHub 用户名>       封禁：刷新令牌时生效，已签发的访问令牌最多再用 1 小时
//   node d1.mjs unban <GitHub 用户名>
//
// 除了 migrate，这些命令都直接读写线上的库。写进 SQL 的值都先过校验，所以可以直接拼进语句里。
import { spawnSync } from "node:child_process";

import { site } from "../site.config.ts";

const [command, ...rest] = process.argv.slice(2);
// GitHub 用户名：字母、数字和中间的单个横线，最长 39。
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

function fail(message) {
	console.error(message);
	process.exit(1);
}

function idOf(name) {
	const id = site.databases[name]?.id;
	if (!id) {
		fail(
			`site.config.ts has no databases.${name}.id yet. Create it with \`cf d1 create\` and fill it in.`,
		);
	}
	return id;
}

/** 运行一条 cf 命令，输出直接打在终端上；失败就退出。 */
function cf(args) {
	// 从 pnpm 的脚本里运行时，cf 在 PATH 上（node_modules/.bin）。
	const result = spawnSync("cf", args, {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function query(name, sql) {
	cf(["d1", "query", idOf(name), "--sql", sql]);
}

function login(value) {
	if (!value || !GITHUB_LOGIN.test(value)) {
		fail("Usage: node d1.mjs ban|unban <github-login>");
	}
	return value;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
const startOfYesterday = Date.parse(`${yesterday}T00:00:00Z`);

switch (command) {
	case "migrate":
		cf([
			"d1",
			"migrations",
			"apply",
			idOf("core"),
			"--dir",
			"migrations/core",
			...rest,
		]);
		cf([
			"d1",
			"migrations",
			"apply",
			idOf("mail"),
			"--dir",
			"migrations/mail",
			...rest,
		]);
		break;
	case "users":
		query(
			"core",
			"SELECT id, github_login, email, plan, status, datetime(created_at / 1000, 'unixepoch') AS joined FROM users ORDER BY id DESC LIMIT 30",
		);
		break;
	case "stats":
		query(
			"core",
			`SELECT day, COUNT(*) AS users, SUM(mailboxes) AS mailboxes FROM usage WHERE day IN ('${today}', '${yesterday}') GROUP BY day ORDER BY day DESC`,
		);
		query(
			"mail",
			`SELECT date(received_at / 1000, 'unixepoch') AS day, COUNT(*) AS messages FROM messages WHERE received_at >= ${startOfYesterday} GROUP BY day ORDER BY day DESC`,
		);
		break;
	case "ban":
		query(
			"core",
			`UPDATE users SET status = 'banned' WHERE github_login = '${login(rest[0])}'`,
		);
		break;
	case "unban":
		query(
			"core",
			`UPDATE users SET status = 'active' WHERE github_login = '${login(rest[0])}'`,
		);
		break;
	default:
		fail(
			"Usage: node d1.mjs migrate | users | stats | ban <login> | unban <login>",
		);
}
