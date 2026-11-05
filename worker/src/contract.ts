// 接口返回的数据结构：Worker、前端、CLI 共用这一份。这个文件不依赖任何模块。

/** 错误响应：`code` 给程序判断，`message` 给人看。 */
export type ApiError = {
	error: string;
	message: string;
};

export type Mailbox = {
	/** 完整地址，带域名。 */
	address: string;
	created_at: number;
	expires_at: number;
};

export type MessageSummary = {
	id: string;
	/** 收件地址，带域名。 */
	to: string;
	from_addr: string;
	from_name: string;
	subject: string;
	received_at: number;
};

export type Message = MessageSummary & {
	text: string | null;
	html: string | null;
};

export type WaitResult = {
	/** 超时没等到就是 null。 */
	message: Message | null;
};

export type Me = {
	user: { id: number; github_login: string; email: string | null };
	plan: string;
	quota: {
		mailboxes_per_day: number;
		mailboxes_today: number;
		/** 今天的配额在这个时间（毫秒）重置，UTC 零点。 */
		resets_at: number;
	};
};

/** `/api/web/session`：网页上当前登录的用户。 */
export type WebSession = {
	user: { id: number; github_login: string } | null;
};

/** `/api/web/device`：用户码对应的设备授权请求。 */
export type DeviceRequest = {
	user_code: string;
	client_name: string;
	expires_at: number;
};

/** `/api/web/oauth/pending`：等待用户确认的 OAuth 授权请求。 */
export type OAuthPending = {
	client_name: string;
	/** redirect_uri 的主机名：确认页上醒目地显示它，用户据此判断是不是自己在用的客户端。 */
	redirect_host: string;
	scope: string;
};

/** `/api/web/account`：账号页。 */
export type Account = {
	user: { id: number; github_login: string; email: string | null };
	plan: string;
	quota: Me["quota"];
	/** 已登录的客户端（每次登录一条，刷新令牌轮换不算新的）。 */
	sessions: { id: string; client_name: string; signed_in_at: number }[];
};

/** 网页会话 cookie 的名字。 */
export const SESSION_COOKIE = "__Host-smails_session";
