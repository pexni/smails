import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_PATH = join(homedir(), ".smails");

interface Config {
  address: string;
  token: string;
}

export function loadConfig(): Config | null {
  try {
    const data = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(data) as Config;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
