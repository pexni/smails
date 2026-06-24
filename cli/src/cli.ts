import { SmailsAPI } from "./api.js";
import { loadConfig, saveConfig } from "./config.js";

function requireConfig() {
	const config = loadConfig();
	if (!config) {
		console.error("No mailbox found. Run `smails create` first.");
		process.exit(1);
	}
	return config;
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
	const result = await api.createMailbox();
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
		const read = msg.read ? " " : "*";
		const date = new Date(msg.received_at).toLocaleString();
		console.log(`${read} ${msg.id.slice(0, 8)}  ${msg.from_addr.padEnd(30)}  ${msg.subject.slice(0, 50)}  ${date}`);
	}
}

async function read(id: string | undefined) {
	if (!id) {
		console.error("Usage: smails read <id>");
		process.exit(1);
	}
	const config = requireConfig();
	const api = new SmailsAPI(config.token);
	const messages = await api.listMessages();
	const match = messages.find((m) => m.id.startsWith(id));
	if (!match) {
		console.error(`No message found starting with "${id}".`);
		process.exit(1);
	}
	const msg = await api.getMessage(match.id);
	console.log(`From:    ${msg.from_name} <${msg.from_addr}>`);
	console.log(`Subject: ${msg.subject}`);
	console.log(`Date:    ${new Date(msg.received_at).toLocaleString()}`);
	console.log("---");
	console.log(msg.text || msg.html || "(empty)");
}

async function whoami() {
	const config = requireConfig();
	console.log(config.address);
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
		case "whoami":
			return whoami();
		default:
			console.log(`Usage: smails <command>

Commands:
  create          Create a new mailbox
  create --new    Replace current mailbox with a new one
  inbox           List messages
  read <id>       Read a message (prefix match)
  whoami          Show current mailbox address
  mcp             Start the MCP server (for AI agents)`);
			process.exit(command ? 1 : 0);
	}
}
