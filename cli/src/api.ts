const DEFAULT_BASE_URL = "https://smails.dev";

export class SmailsAPI {
	private baseUrl: string;
	private token: string | null;

	constructor(token: string | null = null, baseUrl = process.env.SMAILS_API_URL || DEFAULT_BASE_URL) {
		this.baseUrl = baseUrl;
		this.token = token;
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options.headers as Record<string, string>,
		};
		if (this.token) {
			headers["Authorization"] = `Bearer ${this.token}`;
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		let res: Response;
		try {
			res = await fetch(`${this.baseUrl}${path}`, { ...options, headers, signal: controller.signal });
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				throw new Error(`Request timed out after 15s (${this.baseUrl})`);
			}
			throw new Error(`Network error: cannot reach ${this.baseUrl}`);
		} finally {
			clearTimeout(timeout);
		}

		if (!res.ok) {
			const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
			throw new Error(body.error || `HTTP ${res.status}`);
		}
		return res.json() as Promise<T>;
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

	async listMessages(): Promise<Array<{
		id: string;
		from_addr: string;
		from_name: string;
		subject: string;
		preview: string;
		received_at: number;
		read: number;
	}>> {
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
		return this.request(`/api/mailbox/messages/${id}`);
	}

	async deleteMessage(id: string): Promise<void> {
		await this.request(`/api/mailbox/messages/${id}`, { method: "DELETE" });
	}
}
