import { SmailsAPI } from "./api.js";
import { loadConfig, saveConfig } from "./config.js";

const HELP = `smails — disposable email for humans and agents

Usage: smails <command> [options]

Commands:
  create [--domain <d>]   Create a new mailbox (token saved to ~/.smails)
  create --new            Replace the current mailbox with a fresh one
  inbox                   List messages
  read <id>               Read a message (full id or short prefix)
  delete <id>             Delete a message (full id or short prefix)
  whoami                  Show the current mailbox address
  mcp                     Start the MCP server (for AI agents)

Options:
  -h, --help              Show this help
  -v, --version           Show version

Env:
  SMAILS_API_URL          Override the API base URL (default https://smails.dev)`;

const FULL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireConfig() {
	const config = loadConfig();
	if (!config) {
		console.error("No mailbox found. Run `smails create` first.");
		process.exit(1);
	}
	return config;
}

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const value = args[i + 1];
	return value && !value.startsWith("-") ? value : undefined;
}

/** Resolve a full message id from a full id or a short prefix (as shown by `inbox`). */
async function resolveMessageId(api: SmailsAPI, idOrPrefix: string): Promise<string> {
	if (FULL_ID.test(idOrPrefix)) return idOrPrefix;
	const messages = await api.listMessages();
	const matches = messages.filter((m) => m.id.startsWith(idOrPrefix));
	if (matches.length === 0) {
		console.error(`No message found starting with "${idOrPrefix}".`);
		process.exit(1);
	}
	if (matches.length > 1) {
		console.error(`"${idOrPrefix}" is ambiguous (${matches.length} matches). Use more characters.`);
		process.exit(1);
	}
	return matches[0].id;
}

async function create(args: string[]) {
	const existing = loadConfig();
	const isNew = args.includes("--new");
	if (existing && !isNew) {
		console.log(`You already have a mailbox: ${existing.address}`);
		console.log("Use `smails create --new` to create a new one.");
		return;
	}
	const api = new SmailsAPI();
	const result = await api.createMailbox(flag(args, "--domain"));
	saveConfig({ address: result.address, token: result.token });
	console.log(`Mailbox created: ${result.address}`);
}

async function inbox() {
	const config = requireConfig();
	const api = new SmailsAPI(config.token);
	const messages = await api.listMessages();
	if (messages.length === 0) {
		console.log("Inbox is empty.");
		return;
	}
	for (const msg of messages) {
		const mark = msg.read ? " " : "*";
		const date = new Date(msg.received_at).toLocaleString();
		console.log(`${mark} ${msg.id.slice(0, 8)}  ${msg.from_addr.slice(0, 28).padEnd(28)}  ${msg.subject.slice(0, 48).padEnd(48)}  ${date}`);
	}
}

async function read(id: string | undefined) {
	if (!id) {
		console.error("Usage: smails read <id>");
		process.exit(1);
	}
	const config = requireConfig();
	const api = new SmailsAPI(config.token);
	const msg = await api.getMessage(await resolveMessageId(api, id));
	console.log(`From:    ${msg.from_name} <${msg.from_addr}>`);
	console.log(`Subject: ${msg.subject}`);
	console.log(`Date:    ${new Date(msg.received_at).toLocaleString()}`);
	console.log("---");
	console.log(msg.text || msg.html || "(empty)");
}

async function del(id: string | undefined) {
	if (!id) {
		console.error("Usage: smails delete <id>");
		process.exit(1);
	}
	const config = requireConfig();
	const api = new SmailsAPI(config.token);
	const fullId = await resolveMessageId(api, id);
	await api.deleteMessage(fullId);
	console.log(`Deleted ${fullId.slice(0, 8)}.`);
}

function whoami() {
	console.log(requireConfig().address);
}

export async function runCLI(args: string[]) {
	const command = args[0];
	switch (command) {
		case "create":
			return create(args.slice(1));
		case "inbox":
			return inbox();
		case "read":
			return read(args[1]);
		case "delete":
		case "rm":
			return del(args[1]);
		case "whoami":
			return whoami();
		case "-h":
		case "--help":
			return void console.log(HELP);
		default:
			console.log(HELP);
			process.exit(command ? 1 : 0);
	}
}
