export interface Email {
  id: string
  from_addr: string
  from_name: string
  subject: string
  preview: string
  received_at: number
  read: number
}

export interface EmailDetail extends Email {
  html: string | null
  text: string | null
  attachments: unknown[]
}

const TOKEN_KEY = "smails_token"
const ADDRESS_KEY = "smails_address"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getAddress(): string | null {
  return localStorage.getItem(ADDRESS_KEY)
}

function saveAuth(address: string, token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ADDRESS_KEY, address)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADDRESS_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(path, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function createMailbox(domain?: string): Promise<{ address: string; token: string }> {
  const result = await request<{ address: string; token: string }>("/api/mailbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(domain ? { domain } : {}),
  })
  saveAuth(result.address, result.token)
  return result
}

export async function listMessages(): Promise<Email[]> {
  return request<Email[]>("/api/mailbox/messages")
}

export async function getMessage(id: string): Promise<EmailDetail> {
  return request<EmailDetail>(`/api/mailbox/messages/${id}`)
}

export async function deleteMessage(id: string): Promise<void> {
  await request(`/api/mailbox/messages/${id}`, { method: "DELETE" })
}

