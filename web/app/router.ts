import { createRouter, intentPreload } from "@solidjs/router";
import { lazy } from "solid-js";

import Home from "#/routes/home.tsx";

export const Router = createRouter({
	// 鼠标停在链接上（或聚焦、开始触摸）时先取下一页的分块，点下去就不用等。
	preloadLinks: intentPreload(),
	routes: [
		{ path: "/", component: Home },
		{
			path: "/docs/mcp",
			component: lazy(() => import("#/routes/docs/mcp.tsx")),
		},
		{
			path: "/docs/cli",
			component: lazy(() => import("#/routes/docs/cli.tsx")),
		},
		{
			path: "/docs/api",
			component: lazy(() => import("#/routes/docs/api.tsx")),
		},
		{ path: "/otp", component: lazy(() => import("#/routes/otp.tsx")) },
		{ path: "/privacy", component: lazy(() => import("#/routes/privacy.tsx")) },
		{ path: "/device", component: lazy(() => import("#/routes/device.tsx")) },
		{ path: "/consent", component: lazy(() => import("#/routes/consent.tsx")) },
		{ path: "/account", component: lazy(() => import("#/routes/account.tsx")) },
		{ path: "*404", component: lazy(() => import("#/routes/not-found.tsx")) },
	],
});
