import { Router } from "#/router.ts";

import "./global.css";

// 新版本上线后，开着的旧页面再去要的脚本分块已经换了名字。整页重新加载一次就能拿到新版本；
// 记个时间，免得真出故障时没完没了地刷新。
if (typeof window !== "undefined") {
	window.addEventListener("vite:preloadError", () => {
		const key = "smails_reloaded_at";
		try {
			if (Date.now() - Number(sessionStorage.getItem(key)) < 60_000) {
				return;
			}
			sessionStorage.setItem(key, String(Date.now()));
		} catch {
			// 存不了就不记，照样刷新一次
		}
		window.location.reload();
	});
}

export default function App() {
	return <Router>{(props) => <main>{props.children}</main>}</Router>;
}
