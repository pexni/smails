import { createRouter, intentPreload } from "@solidjs/router";
import { lazy } from "solid-js";

import Home from "#/routes/home.tsx";

export const Router = createRouter({
	// 鼠标停在链接上（或聚焦、开始触摸）时先取下一页的分块，点下去就不用等。
	preloadLinks: intentPreload(),
	routes: [
		{ path: "/", component: Home },
		{ path: "*404", component: lazy(() => import("#/routes/not-found.tsx")) },
	],
});
