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
	// 线上的库还没建，建好后把 `cf d1 create` 返回的 id 填进来。
	databases: {
		core: { name: "smails-core", id: "" },
		mail: { name: "smails-mail", id: "" },
	},
	// R2：邮件原文，对象 key 是邮件 id。
	bucket: "smails-mail",
};
