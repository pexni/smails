#!/usr/bin/env node

const args = process.argv.slice(2);

try {
	if (args[0] === "mcp") {
		const { runMCP } = await import("./mcp.js");
		await runMCP();
	} else {
		const { runCLI } = await import("./cli.js");
		await runCLI(args);
	}
} catch (err) {
	console.error(err instanceof Error ? err.message : "Unknown error");
	process.exit(1);
}
