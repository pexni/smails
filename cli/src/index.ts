#!/usr/bin/env node
import pkg from "../package.json" with { type: "json" };
import { NotSignedInError } from "./auth.ts";
import { RequestError } from "./client.ts";
import {
	create,
	type Flags,
	inbox,
	list,
	login,
	read,
	remove,
	signOut,
	wait,
	whoami,
} from "./commands.ts";

const HELP = `smails — disposable email for AI agents

Usage: smails <command> [options]

Account:
  login                     Sign in with GitHub (opens a confirmation link)
  logout                    Sign out on this machine
  whoami                    Show the account, plan and today's quota

Mailboxes:
  create                    Create a mailbox and make it the current one
  list                      List your active mailboxes
  inbox [address]           List messages (default: the current mailbox)
  read <id>                 Read a message (full id, or a short prefix)
  wait [address]            Wait for a new message and print it
      --timeout <seconds>     Give up after this long (default 120)
      --from <text>           Only messages whose sender contains <text>
      --subject <text>        Only messages whose subject contains <text>
      --since <ms>            Only messages after this time (default: now; 0 = any)
  delete <id>               Delete a message

Agents:
  mcp                       Run the MCP server over stdio (for MCP clients)
                            Remote alternative: https://smails.dev/mcp

Options:
  --json                    Print JSON instead of text
  -h, --help                Show this help
  -v, --version             Show the version

Environment:
  SMAILS_URL                Server to use (default https://smails.dev)

Example — sign up somewhere and read the code:
  smails create             # → brave-otter-k3j9x2m8@smails.dev
  smails wait --subject code --timeout 300`;

const VALUE_FLAGS = new Set(["timeout", "from", "subject", "since", "mailbox"]);

function parse(args: string[]): Flags {
	const flags: Flags = { json: false, values: new Map(), positionals: [] };
	for (let index = 0; index < args.length; index++) {
		const arg = args[index]!;
		if (arg === "--json") {
			flags.json = true;
		} else if (arg.startsWith("--")) {
			const [name, inline] = arg.slice(2).split("=", 2) as [
				string,
				string | undefined,
			];
			if (!VALUE_FLAGS.has(name)) {
				throw new Error(`Unknown option --${name}. See \`smails --help\`.`);
			}
			const value = inline ?? args[++index];
			if (value === undefined) {
				throw new Error(`--${name} needs a value.`);
			}
			flags.values.set(name, value);
		} else {
			flags.positionals.push(arg);
		}
	}
	return flags;
}

async function main(argv: string[]): Promise<void> {
	const [command, ...rest] = argv;
	if (
		!command ||
		command === "-h" ||
		command === "--help" ||
		command === "help"
	) {
		console.log(HELP);
		return;
	}
	if (command === "-v" || command === "--version") {
		console.log(pkg.version);
		return;
	}
	if (command === "mcp") {
		const { runMcp } = await import("./mcp.ts");
		await runMcp(pkg.version);
		return;
	}
	const flags = parse(rest);
	const commands: Record<string, (flags: Flags) => Promise<void>> = {
		login: () => login(),
		logout: () => signOut(),
		whoami,
		create,
		list,
		inbox,
		read,
		wait,
		delete: remove,
		rm: remove,
	};
	const run = commands[command];
	if (!run) {
		console.error(`Unknown command "${command}".\n\n${HELP}`);
		process.exitCode = 1;
		return;
	}
	await run(flags);
}

main(process.argv.slice(2)).catch((error: unknown) => {
	if (error instanceof NotSignedInError) {
		console.error(error.message);
	} else if (error instanceof RequestError) {
		console.error(error.message);
	} else {
		console.error(error instanceof Error ? error.message : String(error));
	}
	process.exitCode = 1;
});
