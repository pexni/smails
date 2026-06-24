#!/usr/bin/env node

import pkg from "../package.json" with { type: "json" };

const args = process.argv.slice(2);

try {
	if (args[0] === "-v" || args[0] === "--version") {
		console.log(pkg.version);
	} else if (args[0] === "mcp") {
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
