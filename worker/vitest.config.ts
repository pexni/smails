import { defineConfig } from "vitest/config";

// 不读 vite.config.ts：那里面有 Cloudflare 插件，单元测试在 Node 里跑就行。
export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					include: ["test/unit/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "e2e",
					include: ["test/e2e/**/*.test.ts"],
					environment: "node",
					// 先启动一个真实的 Worker 开发服务器（workerd + 本地 D1/R2/DO），测试直接发请求。
					globalSetup: ["test/global-setup.ts"],
					testTimeout: 30_000,
					hookTimeout: 60_000,
					// 共用一个开发服务器，按文件顺序跑，免得互相抢配额之类的状态。
					fileParallelism: false,
				},
			},
		],
	},
});
