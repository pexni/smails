import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_PATH = join(homedir(), ".smails");

interface Config {
  address: string;
  token: string;
}

export function loadConfig(): Config | null {
  let data: string;
  try {
    data = readFileSync(CONFIG_PATH, "utf-8");
  } catch (err) {
    // No mailbox yet — that's fine. Any other read error (permissions, etc.)
    // must surface so we never treat an existing config as absent.
    if ((err as { code?: string }).code === "ENOENT") return null;
    throw new Error(`Cannot read ${CONFIG_PATH}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(data) as Config;
  } catch {
    throw new Error(
      `Config file ${CONFIG_PATH} is corrupt. Remove it (or run \`smails create --force\`) to start over.`,
    );
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
