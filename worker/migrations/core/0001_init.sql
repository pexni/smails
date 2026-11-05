-- 用户：只用 GitHub 确认身份。id 是令牌里的 sub。
CREATE TABLE users (
	id INTEGER PRIMARY KEY,
	github_id INTEGER NOT NULL UNIQUE,
	github_login TEXT NOT NULL,
	-- GitHub 账号的注册时间（毫秒）：太新的账号不让登录，防止批量养号。
	github_created_at INTEGER NOT NULL,
	plan TEXT NOT NULL DEFAULT 'free',
	-- active | banned。封禁在刷新令牌时生效，已签发的访问令牌最多再用 1 小时。
	status TEXT NOT NULL DEFAULT 'active',
	created_at INTEGER NOT NULL
);

-- OAuth 客户端：CIMD（client_id 本身是一个 https URL）拉取后缓存在这里，DCR 注册的也在这里。
CREATE TABLE oauth_clients (
	client_id TEXT PRIMARY KEY,
	-- cimd | dcr | first_party
	kind TEXT NOT NULL,
	name TEXT NOT NULL,
	-- JSON 数组；redirect_uri 必须和其中一个完全相等。
	redirect_uris TEXT NOT NULL,
	-- CIMD 上次拉取的时间，过 24 小时重新拉。
	fetched_at INTEGER,
	created_at INTEGER NOT NULL
);

-- 授权码：60 秒有效，只能用一次。只存哈希。
CREATE TABLE auth_codes (
	code_hash TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	user_id INTEGER NOT NULL,
	redirect_uri TEXT NOT NULL,
	code_challenge TEXT NOT NULL,
	resource TEXT NOT NULL,
	scope TEXT NOT NULL,
	-- 用这个码换到的刷新令牌属于哪条链：码被重复使用时作废整条链。
	family_id TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	used_at INTEGER
);

-- 刷新令牌：每次使用都轮换。只存哈希。
CREATE TABLE refresh_tokens (
	token_hash TEXT PRIMARY KEY,
	-- 同一次登录轮换出来的令牌属于同一条链。
	family_id TEXT NOT NULL,
	client_id TEXT NOT NULL,
	user_id INTEGER NOT NULL,
	resource TEXT NOT NULL,
	scope TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	-- 已经轮换掉了：再出现说明令牌泄露，作废整条链。
	rotated_at INTEGER,
	revoked_at INTEGER,
	created_at INTEGER NOT NULL
);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- 设备授权（RFC 8628）：CLI 和本地 MCP 的登录。设备码只存哈希，用户码存明文（要在网页上查）。
CREATE TABLE device_codes (
	device_hash TEXT PRIMARY KEY,
	user_code TEXT NOT NULL UNIQUE,
	client_id TEXT NOT NULL,
	resource TEXT NOT NULL,
	scope TEXT NOT NULL,
	-- pending | approved | denied | used
	status TEXT NOT NULL DEFAULT 'pending',
	-- 用户在网页上确认之后才有。
	user_id INTEGER,
	expires_at INTEGER NOT NULL,
	-- 上次轮询的时间：轮询太快返回 slow_down。
	last_poll_at INTEGER,
	created_at INTEGER NOT NULL
);

-- 邮箱归属：每次读邮件都要校验邮箱属于令牌里的用户、并且没有过期。行不删除。
CREATE TABLE mailboxes (
	-- 本地部分（@ 前面），统一小写。
	address TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);
CREATE INDEX idx_mailboxes_user ON mailboxes (user_id, expires_at);

-- 每天的用量，配额按它算。
CREATE TABLE usage (
	user_id INTEGER NOT NULL,
	-- 'YYYY-MM-DD'，UTC
	day TEXT NOT NULL,
	mailboxes INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (user_id, day)
) WITHOUT ROWID;
