import { type ChildProcess, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url).href);

let server: ChildProcess | undefined;

async function waitUntilUp(timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await fetch("http://localhost:8794/api/me");
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
	}
	throw new Error("The worker dev server did not start in time");
}

export async function setup(): Promise<void> {
	rmSync(`${root}/.wrangler/e2e-state`, { recursive: true, force: true });
	server = spawn("pnpm", ["exec", "vite"], {
		cwd: root,
		env: { ...process.env, SMAILS_E2E: "1" },
		stdio: ["ignore", "inherit", "inherit"],
	});
	await waitUntilUp(45_000);
}

export async function teardown(): Promise<void> {
	server?.kill("SIGTERM");
}
