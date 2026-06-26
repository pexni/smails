const DEFAULT_BASE_URL = "https://smails.dev";

export class SmailsAPI {
  private baseUrl: string;
  private token: string | null;

  constructor(
    token: string | null = null,
    baseUrl = process.env.SMAILS_API_URL || DEFAULT_BASE_URL,
  ) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      // Read the body inside the try so the 15s deadline also covers a stalled
      // response body, not just the headers.
      if (!res.ok) {
        const body = (await res.json().catch((e) => {
          // Let an abort during the body read fall through to the timeout
          // mapping below instead of being downgraded to the status text.
          if (e instanceof Error && e.name === "AbortError") throw e;
          return { error: res.statusText };
        })) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timed out after 15s (${this.baseUrl})`);
      }
      // fetch() rejects with a TypeError on network failures (DNS, refused, …);
      // our own HTTP errors above are plain Errors and re-throw unchanged.
      if (err instanceof TypeError) {
        throw new Error(`Network error: cannot reach ${this.baseUrl}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getDomains(): Promise<string[]> {
    return this.request<string[]>("/api/domains");
  }

  async createMailbox(domain?: string): Promise<{ address: string; token: string }> {
    return this.request<{ address: string; token: string }>("/api/mailbox", {
      method: "POST",
      body: JSON.stringify(domain ? { domain } : {}),
    });
  }

  async listMessages(): Promise<
    Array<{
      id: string;
      from_addr: string;
      from_name: string;
      subject: string;
      preview: string;
      received_at: number;
      read: number;
    }>
  > {
    return this.request("/api/mailbox/messages");
  }

  async getMessage(id: string): Promise<{
    id: string;
    from_addr: string;
    from_name: string;
    subject: string;
    received_at: number;
    read: number;
    html: string | null;
    text: string | null;
    attachments: unknown[];
  }> {
    return this.request(`/api/mailbox/messages/${encodeURIComponent(id)}`);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.request(`/api/mailbox/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
