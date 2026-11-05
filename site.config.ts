// 站点配置：域名、Worker 名、数据库和存储桶只写在这一处。
// 前端构建、Worker 配置、运维脚本都从这里读。Worker 的运行代码不直接 import 它，
// 需要的值由 worker/cloudflare.config.ts 作为变量传进去（Cloudflare 的 Vite 插件会把这份
// 配置列进开发服务器的 fs.deny，运行代码再引用会让 `pnpm run dev` 启动失败）。
export const site = {
	// 网站地址，也是生成的邮箱地址里 @ 后面的那部分。
	domain: "smails.dev",
	// Worker 的名字。
	worker: "smails",
	// D1：core 存用户、OAuth 客户端、令牌、邮箱和配额；mail 只存邮件元数据。
	// 用 `cf d1 create --name <名字>` 创建，id 是它返回的 uuid。
	databases: {
		core: { name: "smails-core", id: "064b522f-7651-40dd-94d5-fb7c113b1454" },
		mail: { name: "smails-mail", id: "33b5c7c9-19f6-44a9-8954-1d8fcf5f2255" },
	},
	// R2：邮件原文，对象 key 是邮件 id。
	bucket: "smails-mail",
};
