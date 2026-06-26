export interface Message {
  id: string;
  from_addr: string;
  from_name: string;
  subject: string;
  preview: string;
  received_at: number;
  read: number;
}

// The detail endpoint returns the parsed body instead of the list preview, so
// MessageDetail declares its own fields rather than inheriting `preview`.
export interface MessageDetail {
  id: string;
  from_addr: string;
  from_name: string;
  subject: string;
  received_at: number;
  read: number;
  html: string | null;
  text: string | null;
  attachments: unknown[];
}

const TOKEN_KEY = "smails_token";
const ADDRESS_KEY = "smails_address";

// In-memory fallback so the session still works when localStorage is unavailable
// (Safari private mode, storage disabled, or quota exceeded) instead of throwing.
let memToken: string | null = null;
let memAddress: string | null = null;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Prefer the in-memory copy: it's set on every saveAuth, so it always holds the
// freshest credentials. When a localStorage write has failed (quota / private
// mode) storage may still hold a stale value, so reading memory first avoids
// authenticating against the old mailbox. Fall back to storage only on a fresh
// page load, where memory is empty and the persisted value is all we have.
export function getToken(): string | null {
  return memToken ?? readStored(TOKEN_KEY);
}

export function getAddress(): string | null {
  return memAddress ?? readStored(ADDRESS_KEY);
}

function saveAuth(address: string, token: string) {
  memToken = token;
  memAddress = address;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADDRESS_KEY, address);
  } catch {
    // keep the in-memory copy; persistence is best-effort
  }
}

export function clearAuth() {
  memToken = null;
  memAddress = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADDRESS_KEY);
  } catch {
    // already cleared in memory
  }
}

const VERSION_HEADER = "X-Smails-Version";
let serverVersion: string | null = null;
let onUpdate: (() => void) | null = null;

/** Register a callback fired once when the backend deploy id changes mid-session. */
export function onServerUpdate(cb: () => void) {
  onUpdate = cb;
}

// Compare the deploy id stamped on each API response against the one first seen
// this session; a change means the backend was redeployed and this tab is stale.
function checkVersion(res: Response) {
  const version = res.headers.get(VERSION_HEADER);
  if (!version) return;
  if (serverVersion === null) {
    serverVersion = version;
  } else if (version !== serverVersion) {
    serverVersion = version;
    onUpdate?.();
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...options, headers });
  checkVersion(res);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    const error = new Error(body.error || `HTTP ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json() as Promise<T>;
}

export async function createMailbox(domain?: string): Promise<{ address: string; token: string }> {
  const result = await request<{ address: string; token: string }>("/api/mailbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(domain ? { domain } : {}),
  });
  saveAuth(result.address, result.token);
  return result;
}

export async function listMessages(): Promise<Message[]> {
  return request<Message[]>("/api/mailbox/messages");
}

export async function getMessage(id: string): Promise<MessageDetail> {
  return request<MessageDetail>(`/api/mailbox/messages/${encodeURIComponent(id)}`);
}

export async function deleteMessage(id: string): Promise<void> {
  await request(`/api/mailbox/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
}
