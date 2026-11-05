import { createMemo, createSignal, onSettled } from "solid-js";

import { WebApiError } from "#/api.ts";

export type Loaded<T> =
	| { state: "loading" }
	| { state: "ok"; value: T }
	| { state: "error"; status: number; message: string };

const LOADING = { state: "loading" } as const;

/**
 * 只在浏览器里取的数据。页面是构建时预渲染的静态 HTML，那时没有会话、也没有 Worker 可问，
 * HTML 里永远是“加载中”的样子；浏览器接管（onSettled）之后才去取。错误也变成一个状态返回，
 * 页面自己决定怎么显示，不抛给错误边界。`reload()` 重新取一次。
 */
export function useClientData<T>(load: () => Promise<T>) {
	const [ready, setReady] = createSignal(false);
	const [version, setVersion] = createSignal(0);
	onSettled(() => {
		setReady(true);
	});
	const data = createMemo<Loaded<T> | Promise<Loaded<T>>>(() => {
		version();
		if (!ready()) {
			return LOADING;
		}
		return load().then(
			(value): Loaded<T> => ({ state: "ok", value }),
			(error: unknown): Loaded<T> => ({
				state: "error",
				status: error instanceof WebApiError ? error.status : 0,
				message:
					error instanceof Error ? error.message : "Something went wrong.",
			}),
		);
	}) as () => Loaded<T>;
	return { data, reload: () => setVersion((value) => value + 1) };
}
