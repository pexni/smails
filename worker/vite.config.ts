import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// 端到端测试（test/global-setup.ts）用另一个端口和一份单独的本地数据，不碰开发时的数据。
const testing = process.env.SMAILS_E2E === "1";

export default defineConfig({
	// 网站本身是前端项目的构建产物：这里把它当作静态文件原样带进部署包。
	// 先构建 ../web，再构建这里。
	publicDir: "../web/dist/client",
	// 8787 是 wrangler 的默认端口，8791 是 smail 的；这里固定用 8792，免得撞。
	server: { port: testing ? 8794 : 8792, strictPort: true },
	plugins: [
		cloudflare(
			testing ? { persistState: { path: ".wrangler/e2e-state" } } : {},
		),
	],
});
