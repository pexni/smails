import type { StartMiddleware } from "@solidjs/vite-plugin";
import { announcePages } from "prerender-crawler/announce";

// 全站页面清单。预渲染的爬虫从首页出发顺着链接找页面，这里把清单直接告诉它，
// 免得哪个页面没有被链接到就漏掉。
export const PAGE_PATHS = ["/"];

/**
 * 只在构建时（和本地开发时）运行：网站上线后是纯静态文件，没有这一层。
 */
const buildMiddleware: StartMiddleware = async ({ request }, next) => {
	const response = await next();
	if (new URL(request.url).pathname === "/") {
		announcePages(request, response.headers, PAGE_PATHS);
	}
	return response;
};

export default buildMiddleware;
