import { SmailsAPI } from "./api.js";
import { loadConfig, saveConfig } from "./config.js";

export type CreateResult =
  | { created: true; address: string }
  | { created: false; existing: string };

/**
 * Create a mailbox and persist it to the local config. Shared by the CLI
 * `create` command and the MCP `create_mailbox` tool so the recovery semantics
 * live in one place.
 *
 * When `force` is false an existing saved mailbox short-circuits with
 * `created: false`. `force` also skips loadConfig entirely so it can recover even
 * when the saved config is unreadable/corrupt (loadConfig throws in that case).
 */
export async function createMailbox(
  domain: string | undefined,
  force: boolean,
): Promise<CreateResult> {
  if (!force) {
    const existing = loadConfig();
    if (existing) return { created: false, existing: existing.address };
  }
  const result = await new SmailsAPI().createMailbox(domain);
  saveConfig({ address: result.address, token: result.token });
  return { created: true, address: result.address };
}
