# smails 重写设计：只服务 Agent、强制登录、成本压到最低

日期：2026-11-05 · 状态：草案，待审

## 1. 背景与数据

现在每月成本约 $200，而且还在涨。98% 的量来自同一个批量注册脚本，按 IP 限流对它无效。

数据来自 Cloudflare GraphQL 分析，统计窗口是 2026-11-04 07:00 到 11-05 07:00 UTC。费用是按官方价格推算的，以账单为准。

| 指标 | 24 小时数值 | 说明 |
| --- | --- | --- |
| 创建邮箱 `POST /api/mailbox` | 约 34.5 万次 | `python-requests/2.34.2` 约 33.7 万次（98%） |
| 收件 | 约 73 万封 | 平均每个邮箱约 2 封 |
| 列表 `GET /messages` | 约 92.7 万次 | 脚本平均每个邮箱只拉 2.7 次，轮询不是大头 |
| 脚本使用的 IP | 至少 1 万个，分布在 23 个国家 | 每个 IP 每天中位数 6 次，典型的住宅代理池 |
| DO SQLite 存储 | 137 GB | 7 天前约 2 GB，每天涨约 25 GB |
| DO 写入行数 | 约 580 万行/天 | 大部分来自每次请求都会调用的 `setAlarm` |
| 网页真人 | 首页 217 个 IP，WebSocket 117 个 IP | 每天一两百人 |
| CLI / MCP（UA 为 `node`） | 创建 745 次 | 其中 711 次来自同一个 IP |

- **WAF 限流无效**：规则是每个 IP 每 10 秒最多 2 次，2026-11-05 06:28 UTC 生效。生效后每 5 分钟仍有约 900–1200 次创建，只拦下约 30 次。脚本每个 IP 每小时最多 18 次、中位数 1 次，远低于阈值。
- **成本放大点**：每创建一个邮箱就建一个 DO 并写入存储；每次读都 `setAlarm`；原始邮件 base64 存 7 天；有两个 DO 因为客户端疯狂发 ping，一天被请求 1250 万次。
- **参照项目 smail.pw**：元数据存 D1、原文存 R2，平均每封原文约 23 KB；推送用一个全站共用的 `InboxHub` DO。

## 2. 目标与非目标

**目标**

1. 只服务 agent：CLI、本地 MCP（stdio）、远程 MCP（HTTP）。
2. 所有使用都必须登录（GitHub），不再有匿名入口。
3. 单个邮箱的成本压到最低：创建、读取都不产生多余写入；邮件不删除，结构和 smail.pw 一样（D1 存元数据，R2 存原文）。
4. agent 能**等**到新邮件，而不是反复轮询。
5. 为以后收费留好位置：用户有档位，配额按档位来定。

**非目标**

- 网页收件箱。真人用户请去 [smail.pw](https://smail.pw)。
- 附件。只保留 text 和 html 正文，agent 读验证码和登录链接不需要附件。
- 第一版不接收款，只预留 `plan` 字段。
- 兼容旧的匿名 API 和旧令牌。

## 3. 总体架构

```
                    ┌────────────────────────── Worker (smails.dev) ─────────────────────────┐
 CLI / 本地 MCP ──┐ │                                                                         │
                  ├─┼─▶ /api/*      邮箱 API（Bearer 访问令牌，验签不查库）                  │
 远程 MCP 客户端 ─┘ │   /mcp        MCP Streamable HTTP，无会话                              │
                    │   /authorize /token /register /device …   自实现的 OAuth 2.1 授权服务器 │
 浏览器 ───────────▶│   静态页面：介绍 / 文档 / 授权确认页（不经过 Worker 的部分都免费）       │
                    │                                                                         │
 Email Routing ────▶│   email()   解析一次 → 先写 R2 原文 → 再写 D1 元数据 → 通知 InboxHub     │
                    │   scheduled() 每天：清理过期的授权码、设备码、刷新令牌                   │
                    └──────┬───────────────┬──────────────┬──────────────────┬────────────────┘
                           │               │              │                  │
                     D1 core          D1 mail         R2 mail           InboxHub（一个 DO）
                     用户/客户端/     邮件元数据 +     邮件原文，        WebSocket Hibernation，
                     刷新令牌/邮箱/   正文开头一段，   key = 邮件 id，   按地址打 tag，只发信号，
                     配额             不删除           不删除            不存数据
                           ▲
                           └── GitHub OAuth（只用来确认"你是谁"）
```

- 去掉每个邮箱一个的 `Mailbox` DO，去掉浏览器 WebSocket，去掉网页收件箱。
- D1 分成两个库：`core` 写入少、需要强一致；`mail` 只存邮件元数据，会一直增长，单独放一个库，方便盯它离 10 GB 上限还有多远。
- 所有凭证都**签名验证**，热路径（每个 API 请求）不读 KV 也不读 D1。

## 4. 身份与授权

### 4.1 规范要求（MCP Authorization，2026-07-28 版）

- 只适用于 HTTP 传输（远程 MCP）。stdio 的本地 MCP 从本地配置里拿凭证，不走这套流程。
- OAuth 2.1，必须用 PKCE（S256）。
- MCP 服务器必须提供 Protected Resource Metadata（RFC 9728）；授权服务器必须提供 RFC 8414 元数据。
- 客户端注册：规范推荐 Client ID Metadata Documents（CIMD）；Dynamic Client Registration（DCR）已标为弃用，但为了兼容老客户端仍然支持；也可以预注册。
- 客户端必须带 `resource` 参数（RFC 8707），我们只接受签发给自己的令牌。
- 授权响应里带 `iss`（RFC 9207），并在元数据里声明 `authorization_response_iss_parameter_supported: true`。

### 4.2 我们的角色

同一个 Worker 既是资源服务器，也是授权服务器。用户身份交给 GitHub 来认（上游 IdP），我们保存 GitHub 的 `id`、`login`、`created_at` 和**已验证的主邮箱**（登录时申请 `user:email`，读 `/user/emails`）。**不使用任何第三方 OAuth 库**，全部自己实现，数据存在 D1。

### 4.3 远程 MCP 的登录流程

1. 客户端请求 `/mcp`，没带令牌 → 返回 `401`，`WWW-Authenticate: Bearer resource_metadata="https://smails.dev/.well-known/oauth-protected-resource/mcp", scope="mail"`。
2. 客户端读取资源元数据 → 再读取授权服务器元数据。
3. 客户端注册：
   - CIMD：`client_id` 本身是一个 https URL。我们拉取这个 URL 的元数据，校验其中的 `redirect_uris`，结果缓存在 D1 的 `oauth_clients` 表里，24 小时后重新拉取；
   - DCR：`POST /register`，写入 `oauth_clients`。
4. `GET /authorize`：校验 `client_id`、`redirect_uri` 必须完全匹配、`code_challenge`（S256）、`resource`、`state`。所有参数存进一个签名的、短期有效的 cookie，然后跳转到 GitHub 授权。
5. `GET /oauth/github/callback`：用 code 向 GitHub 换取 GitHub 令牌，读取 `/user`，检查账号规则（4.6），upsert 到 `users` 表。然后**显示我们自己的授权确认页**，写明"某某客户端（显示 redirect 的域名）想访问你的 smails"。
6. 用户点"允许" → 签发授权码（D1，60 秒有效，只能用一次）→ 带着 `code`、`state`、`iss` 跳回客户端的 `redirect_uri`。
7. `POST /token`，`grant_type=authorization_code`：校验 `code_verifier`、`redirect_uri`、`resource`、`client_id`，然后签发访问令牌和刷新令牌。
8. `POST /token`，`grant_type=refresh_token`：每次都轮换刷新令牌；发现旧的刷新令牌被重复使用，就作废这个令牌所属的整条链。

### 4.4 CLI 和本地 MCP：标准的设备授权（RFC 8628），由我们自己的授权服务器实现

```
终端 / agent                                   浏览器（用户）
1. smails login
   → 打开这个链接确认登录：
     https://smails.dev/device?code=WDJB-MJHT
     （或者打开 https://smails.dev/device，输入 WDJB-MJHT）
                                               2. 打开链接，代码已经填好
                                               3. 还没登录 → 跳转到 GitHub 登录，再跳回来
                                               4. 确认页：“登录 smails CLI？代码 WDJB-MJHT”
                                                  → 点“确认”
5. CLI 每 5 秒轮询一次 /token
   → 确认了，拿到令牌，保存到 ~/.smails
```

- `POST /device/code` 按 RFC 8628 返回 `device_code`、`user_code`、`verification_uri`、**`verification_uri_complete`**（已经带上代码的链接）、`expires_in`（600 秒）、`interval`（5 秒）。CLI 优先显示带代码的那个链接，点开就能确认。
- 用户码 8 位，只用不容易混淆的大写字母（不用 0/O、1/I），中间加一个短横线，方便念出来和输入。
- 确认页上**必须显示用户码**，让用户核对和终端上的一样。只有用户点"确认"才算授权，打开链接本身不算。这样即使有人把别人的链接发给你，也需要你核对、确认以后才生效。
- 确认页的提交要求同源（校验 `Origin`，会话 cookie 是 `SameSite=Lax`），页面禁止被嵌进 iframe。
- CLI 轮询时按 RFC 8628 处理 `authorization_pending`、`slow_down`（间隔加 5 秒）、`access_denied`、`expired_token`。
- 本地 MCP 增加一个 `login` 工具：把带代码的链接返回给 agent，由 agent 转告用户；用户在网页上点确认以后，再调一次 `login` 就完成了，用户不需要自己开终端。
- 不用 GitHub 自己的 device flow。网页登录、CLI 登录、远程 MCP 都走同一个 GitHub 回调，**三种入口拿到的是同一种令牌**（第 4.5 节）。

### 4.5 令牌格式

| 令牌 | 格式 | 有效期 | 存储 |
| --- | --- | --- | --- |
| 访问令牌 | `sma1.<base64url(JSON 声明)>.<base64url(HMAC-SHA256)>` | 1 小时 | 不存储，验签 |
| 刷新令牌 | `smr1.<32 字节随机数>` | 90 天，每次使用都轮换 | D1 只存 SHA-256 |
| 授权码 | 32 字节随机数 | 60 秒，只能用一次 | D1 只存 SHA-256 |
| 设备码 / 用户码 | 32 字节随机数 / 8 位字母 | 10 分钟 | D1 只存 SHA-256 |

访问令牌的声明：`sub`（用户 id）、`aud`（`https://smails.dev/mcp` 或 `https://smails.dev/api`；设备授权默认签 `/mcp`，因为本地 MCP 转发给远程 `/mcp`，而 `/api` 两种都接受）、`scope`、`plan`、`cid`（客户端 id）、`iat`、`exp`。

- 档位放在令牌里，所以配额检查不用查用户表。档位变化最多 1 小时后生效（下次刷新时）。
- 封禁用户：刷新时检查 `users.status`。已经签发的访问令牌最多再用 1 小时。
- 密钥 `TOKEN_SECRETS` 用逗号分隔：最左边的用来签名，其余的只用来验证，方便轮换。

### 4.6 账号规则（防止批量养号）

- GitHub 账号注册满 `MIN_GITHUB_AGE_DAYS` 天，默认 30 天。
- 配额按 GitHub 用户计算，换客户端或重新登录都不会重置。
- 用户表可以随时把某人标记为 `banned`。

### 4.7 必须做对的安全点（每一条都要有测试）

- `redirect_uri` 字符串完全匹配，不接受前缀匹配或通配。
- 授权确认页不能省：所有客户端共用我们一个 GitHub 应用，不加这一页的话，恶意客户端可以借着用户已登录 GitHub 的状态悄悄拿到令牌。确认页要禁止被嵌进 iframe（`frame-ancestors 'none'`）。
- 拉取 CIMD 时只允许 https，设 3 秒超时、响应最大 16 KB，只解析 JSON，并且要求文档里的 `client_id` 等于这个 URL 本身。
- PKCE 只接受 S256。授权码用一次就作废，第二次使用时作废它签发出去的所有令牌。
- 校验令牌的 `aud`。`/mcp` 只接受 `aud=https://smails.dev/mcp`，`/api/*` 两种都接受。
- 访问令牌只能放在 `Authorization` 头里，不接受出现在 URL 里。
- 比较密钥和哈希时用 `crypto.subtle.timingSafeEqual`。

## 5. 邮箱

### 5.1 地址

格式：`<形容词>-<名词>-<4 位随机>` + `<4 位校验码>` + `@smails.dev`，例如 `brave-curie-k3j9x2m8@smails.dev`。

- 校验码 = `base36(HMAC(ADDR_SECRET, 前面那部分)) 的前 4 位`。
- 收件时先检查校验码。不是我们发出去的地址（垃圾邮件、乱填的地址）**直接丢弃，不写任何东西**。
- 词表由我们自己维护。现在用的 `@scaleway/random-name` 内部用的是 `Math.random`、词表也没有导出，换掉它。

### 5.2 归属和有效期

- 创建时在 `core.mailboxes` 里写一行：`(address, user_id, created_at, expires_at)`。
- 邮箱默认 **7 天**有效。过期以后谁都读不到它的邮件，但邮件本身不删除（和 smail.pw 一样，"长期保留但不保证"）。
- 每次读取都要校验 `mailboxes.user_id = 令牌里的 sub` 并且邮箱没有过期，这一步是 1 次按主键的读取。
- `mailboxes` 表里的行也不删，过期只看 `expires_at`。

### 5.3 配额

- 每次创建邮箱，在 `core.usage(user_id, day)` 上 `+1`：一条 UPSERT，并且带上条件，超过档位上限就不加。
- 默认档位：`free` 每天 20 个邮箱。具体数字写在配置里。
- 超出配额返回 `429`，附带下次重置的时间。

## 6. 邮件存储

结构照搬 smail.pw（`smail/main/worker/src/mail.ts`）：**原文存 R2，D1 只存元数据，都不删除，不存 preview**。

smail.pw 线上实测：479 万封邮件，D1 整个库 1.18 GB，**平均每封约 245 字节**（包含索引）。按 smails 登录后的预期量（每天约 1.6 万封）：

| 放在哪 | 每封大小 | 一年累计 | 结论 |
| --- | --- | --- | --- |
| D1 `mail`：元数据 | 约 250 B | 约 1.4 GB | 单库 10 GB 能用好几年 |
| R2：原文 | 约 23 KB（smail.pw 实测平均） | 约 135 GB | 约 $2/月，每年再涨约 $2 |

R2 每月写入约 50 万次，在 100 万次的免费额度内；D1 每月写入约 150 万行，远低于 5000 万的免费额度。

### 6.1 收件流程（`email()`）

1. 超过 5 MB 的直接拒收（`setReject`）。
2. 检查地址校验码，不对就丢弃（第 5.1 节）。
3. 用 PostalMime 解析一次，只取 `from_addr`、`from_name`、`subject`。
4. **先写 R2 再写 D1**：原文 `PUT` 到 R2（key = 邮件 id），再插入 D1。D1 写入失败就把刚写的 R2 对象删掉，然后抛出错误。这样列表里出现的邮件一定打得开。
5. 抛出错误会让 Email Routing 通知发件方重试，不能悄悄丢信。
6. 调用 `InboxHub.notify(address)`。

### 6.2 表结构（`mail` 库）

```sql
CREATE TABLE messages (
  id          TEXT    PRIMARY KEY,           -- 随机 id，也是 R2 的 key
  address     TEXT    NOT NULL,              -- 不含域名，统一小写
  from_addr   TEXT    NOT NULL,
  from_name   TEXT    NOT NULL,
  subject     TEXT    NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_address_time ON messages (address, received_at DESC);
```

和 smail.pw 的 `emails` 表基本一样，只是少了它用来做全局按时间排序的 `idx_emails_time` 索引，我们用不到。

### 6.3 读取

- **列表**：`SELECT … FROM messages WHERE address = ? ORDER BY received_at DESC LIMIT 50`，走索引，只返回元数据（发件人、主题、时间、id）。
- **单封邮件**：先查 D1 确认这封信属于当前用户、邮箱没有过期，再从 R2 读原文，用 PostalMime 解析后返回 `text` 和 `html`。
- **等待新邮件**（第 7 节）：等到以后**直接返回新邮件的正文**（多一次 R2 读取）。agent 最常见的用法是"等验证码"，一次 `wait` 就能拿到，不用再调一次 `read`。

### 6.4 以后量上去了怎么办

- R2 存储：给桶加一条生命周期规则（比如 30 天后过期），规则自己会删，不用改代码。D1 的行保留，读取时如果 R2 已经没有原文，就返回"原文已过期"。
- D1 快到 10 GB：把 `mail` 库按年拆成新库。
- 那个脚本付费回来、量恢复到每天 73 万封：R2 写入约 $94/月，要算进付费档的价格里。

## 7. 新邮件推送和等待

**照搬 smail 的 `InboxHub`**（`smail/main/worker/src/inbox-hub.ts`）：全站共用一个 DO，用 WebSocket Hibernation，按地址给连接打 tag，`ping` 由 `setWebSocketAutoResponse` 自动应答，只推送"来信了"这个信号。

**agent 这边不用连 WebSocket，用 HTTP 长轮询**：`GET /api/mailboxes/:address/wait?since=<ms>&timeout=<s>`

1. Worker 先用 WebSocket 连上 `InboxHub`，带上地址的 tag，然后 DO 进入休眠。
2. **连上以后**再查一次 D1，有 `received_at > since` 的邮件就直接返回。先连后查，这样两步之间到的信不会漏掉。
3. 否则就等，直到收到信号（再查一次 D1，然后返回）或者超时（返回空结果）。

成本：等待期间 Worker 不按时长计费，DO 在休眠，也不计时长费。所以一次等待 = 1 次 Worker 请求 + 1 次 DO 请求，跟等多久无关。

- `timeout` 默认 50 秒、最大 50 秒，因为很多 MCP 客户端的工具调用超时是 60 秒。CLI 的 `wait` 会自动续等，直到用户设定的总时长。
- 可选的过滤参数：`from`、`subject`，子串匹配，不区分大小写，在服务端过滤。

## 8. 接口清单

**OAuth / 元数据**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/.well-known/oauth-protected-resource/mcp` | 资源元数据：`resource=https://smails.dev/mcp` |
| GET | `/.well-known/oauth-protected-resource` | 同上，给 `/api` 用 |
| GET | `/.well-known/oauth-authorization-server` | 授权服务器元数据 |
| POST | `/register` | DCR |
| GET | `/authorize` | 授权入口，跳转到 GitHub |
| GET | `/oauth/github/callback` | GitHub 回调，显示授权确认页 |
| GET | `/consent`、`/device` | 授权确认页、Device Login 确认页（前端的静态页面） |
| GET | `/api/web/session` | 网页上当前登录的用户 |
| POST | `/api/web/logout` | 退出网页登录 |
| GET / POST | `/api/web/oauth/pending`、`/api/web/oauth/consent` | 确认页读取待确认的请求、提交"允许"或"拒绝"（要求同源） |
| GET / POST | `/api/web/device` | Device Login 确认页读取、提交（要求同源） |
| GET | `/__dev/login` | **只在本地开发时存在**：不经过 GitHub，直接登录一个测试用户。生产构建里整段被去掉 |
| POST | `/token` | `authorization_code`、`refresh_token`、`device_code` 三种 |
| POST | `/device/code` | 设备授权的开始 |
| POST | `/revoke` | 撤销刷新令牌 |

**邮箱 API**（`Authorization: Bearer <访问令牌>`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/me` | 用户、档位、今日已用配额 |
| POST | `/api/mailboxes` | 创建邮箱 → `{ address, expires_at }` |
| GET | `/api/mailboxes` | 我的有效邮箱 |
| DELETE | `/api/mailboxes/:address` | 删除邮箱 |
| GET | `/api/mailboxes/:address/messages` | 列表：只有元数据 |
| GET | `/api/mailboxes/:address/wait` | 等待新邮件，等到后直接返回正文（第 7 节） |
| GET | `/api/messages/:id` | 单封邮件：从 R2 读原文，返回 `text` + `html` |
| DELETE | `/api/messages/:id` | 删除一封邮件 |

旧接口 `/api/mailbox*` 一律返回 `410 Gone`，响应体里写清楚怎么迁移（"运行 `npx @smails/cli login`"）。**那个脚本就是在这一步被挡掉的。**

**MCP**：`POST /mcp`，Streamable HTTP，无状态（不发 `Mcp-Session-Id`，只返回 JSON，不开 SSE 流）。工具和本地 MCP 一样：`create_mailbox`、`list_mailboxes`、`list_messages`、`read_message`、`wait_for_message`、`delete_message`，本地 MCP 另外多一个 `login`。

## 9. D1 表结构（core 库）

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,          -- 自增 id，用作令牌里的 sub
  github_id     INTEGER NOT NULL UNIQUE,
  github_login  TEXT    NOT NULL,
  github_created_at INTEGER NOT NULL,
  plan          TEXT    NOT NULL DEFAULT 'free',
  status        TEXT    NOT NULL DEFAULT 'active',  -- active | banned
  created_at    INTEGER NOT NULL
);

CREATE TABLE oauth_clients (
  client_id     TEXT PRIMARY KEY,             -- CIMD 的 URL，或 DCR 生成的 id
  kind          TEXT NOT NULL,                -- cimd | dcr
  name          TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,                -- JSON 数组
  fetched_at    INTEGER,                      -- CIMD 上次拉取的时间
  created_at    INTEGER NOT NULL
);

CREATE TABLE auth_codes (
  code_hash     TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  user_id       INTEGER NOT NULL,
  redirect_uri  TEXT NOT NULL,
  challenge     TEXT NOT NULL,
  resource      TEXT NOT NULL,
  scope         TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  used_at       INTEGER
);

CREATE TABLE refresh_tokens (
  token_hash    TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL,                -- 同一次登录轮换出来的令牌属于同一条链
  client_id     TEXT NOT NULL,
  user_id       INTEGER NOT NULL,
  resource      TEXT NOT NULL,
  scope         TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  rotated_at    INTEGER,                      -- 已经被轮换掉；再出现就作废整条链
  revoked_at    INTEGER
);
CREATE INDEX idx_refresh_family ON refresh_tokens (family_id);

CREATE TABLE device_codes (
  device_hash   TEXT PRIMARY KEY,
  user_code     TEXT NOT NULL UNIQUE,
  client_id     TEXT NOT NULL,
  user_id       INTEGER,                      -- 用户确认后才有
  expires_at    INTEGER NOT NULL,
  last_poll_at  INTEGER
);

CREATE TABLE mailboxes (
  address       TEXT PRIMARY KEY,             -- 不含 @ 后面的域名
  user_id       INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX idx_mailboxes_user ON mailboxes (user_id, expires_at);

CREATE TABLE usage (
  user_id       INTEGER NOT NULL,
  day           TEXT    NOT NULL,             -- 'YYYY-MM-DD'，UTC
  mailboxes     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
) WITHOUT ROWID;
```

mail 库里只有第 6.2 节的 `messages` 表。

## 10. CLI、MCP 和前端

**CLI（`@smails/cli` v0.1.0，破坏性更新）**

- 新命令：`login`、`logout`、`whoami`（显示 GitHub 账号、档位、今日配额）、`create`、`list`、`inbox [address]`、`read <id>`、`wait [address] [--timeout 120] [--from x] [--subject y]`、`delete`。
- 配置文件 `~/.smails`：保存访问令牌、刷新令牌、过期时间、当前地址。访问令牌过期前自动刷新。
- `wait` 收到邮件后直接打印正文，在脚本里可以写成一行 `smails wait | grep -oE '[0-9]{6}'`。
- 旧版 CLI 调用时会收到 410，提示它升级。

**本地 MCP**：用同一份配置。没登录时，工具会返回"请调用 `login` 工具"。

**远程 MCP**：`https://smails.dev/mcp`。在 `server.json` 里增加 `remotes` 条目，提交到 MCP Registry。

**前端（Solid 2 + StyleX 重写，见第 15 节）**

- 首页是面向 agent 的介绍页：远程 MCP 的地址、CLI 的安装和登录、API 示例。醒目的位置写"自己收邮件请用 smail.pw"。
- 文档页：`/docs/mcp`、`/docs/cli`、`/docs/api`、`/otp`。`/mcp` 是 MCP 端点，浏览器打开它（`Accept: text/html`）时 301 到 `/docs/mcp`；旧的 `/email-api` 由 `_redirects` 跳到 `/docs/api`。内容按新接口重写，去掉"不用注册、不要 API key"这类说法。
- 登录相关页面：`/device`（Device Login 确认）、`/authorize`（OAuth 授权确认）、`/account`（档位、今日用量、已登录的客户端、撤销登录）。
- 隐私说明：我们会保存 GitHub id 和用户名。
- 删掉现在的收件箱界面、WebSocket hook 和 shadcn 组件。

## 11. 成本估算

按 Workers Paid 套餐的官方价格推算，不含所有 Worker 共用的 $5 套餐费。

| 场景 | Worker 请求 | D1 | R2 | DO | 合计（每月） |
| --- | --- | --- | --- | --- | --- |
| 现在 | 约 $20 | — | — | 写入约 $125 + 存储约 $35 + 请求和时长约 $25 | **约 $200，还在涨** |
| 新架构，脚本被挡掉（正常用户每天约 8000 次创建） | 在免费额度内 | 在免费额度内 | 在免费额度内 | 在免费额度内 | **约 $0** |
| 新架构，脚本付费并保持现在的量 | 约 $16 | 写入约 6600 万行/月，约 $16；存储每年约 65 GB，要按年拆库 | 写入约 $94，存储每年多约 $100 | 通知约 $3 | **约 $130 起，逐月上涨**，要算进付费档的价格 |

## 12. 上线步骤与迁移

> 可以照着执行的清单在 [launch.md](launch.md)，下面是概要。

1. **准备工作（你来操作）**：建 GitHub OAuth App；建 D1 库 `smails-core`、`smails-mail`；建 R2 桶 `smails-mail`（先不加生命周期规则）；把 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`TOKEN_SECRETS`、`ADDR_SECRET` 写进 `worker/.env.production`，首次部署时用 `cf deploy --prebuilt --secrets-file .env.production` 带上（以后单独改用 `cf workers secrets update`）。
2. **开发**：在新分支上实现，用 `pnpm run dev`（Vite + `@cloudflare/vite-plugin`）和本地 D1 跑通，本地密钥放 `worker/.env`。单元测试覆盖令牌、PKCE、CIMD 校验、地址校验码；端到端测试覆盖登录 → 创建 → 发一封测试邮件 → `wait` → 读取。
3. **用真实客户端验证**：在本地开发服务器上，用 Claude Code、Cursor 等实际走一遍远程 MCP 的登录（不设 staging 环境）。
4. **部署 worker**：新接口上线，旧接口返回 410。**从这一刻起脚本被挡住。**
   - 暂时保留 `Mailbox` 这个 DO 类，但把它精简到只剩 `alarm()` 清空数据，WebSocket 一连上就关闭。没有新的访问以后，旧 DO 会在 7 天内各自通过 alarm 删掉自己的数据，137 GB 会自然清零，不用跑一次性的批量删除。
5. **发布 CLI v0.1.0**，更新 `server.json` 并提交到 MCP Registry。
6. **7 天后**：确认 DO 存储已经降到接近 0，再用 `deleted_classes` 迁移把 `Mailbox` 类删掉。**这一步不可逆，执行前你要再确认一次。**

回滚：`cf workers versions list` 找到旧版本，再用 `cf workers deployments create` 把 100% 流量切回去（第 6 步之前都可以）。新建的 D1 库和 R2 桶不影响旧版本。旧 DO 的数据在第 4 步之后只会通过 alarm 逐步删除，回滚也救不回来已经删掉的部分。

## 13. 风险与待验证项

| 项目 | 风险 | 怎么验证 / 应对 |
| --- | --- | --- |
| D1 `mail` 库持续增长 | 单库上限 10 GB，按预期量约一年 1.4 GB | 定期用 `cf d1 get` 看库的大小；快满时按年拆库 |
| 邮件长期保存 | 验证码、登录链接一直留在库里 | 邮箱过期后谁都读不到；隐私说明里写清楚 |
| 量重新上来 | R2 写入按次收费，每天 73 万封时约 $94/月 | 付费档定价覆盖；或者加 R2 生命周期规则 |
| 在 Workers 上跑 MCP | 官方 TS SDK 的 Streamable HTTP 传输不一定能直接在 Workers 上用 | 先读 SDK 的源码；不行就手写 JSON-RPC（只需要 `initialize`、`tools/list`、`tools/call`） |
| 客户端对 OAuth 的支持 | 有的客户端只支持 DCR，或者用的是旧版规范 | 第 12 步第 3 条实测；DCR 保留 |
| Worker 作为 WebSocket 客户端连 DO | `wait` 依赖这个能力 | 先写一个最小的原型验证 |
| 批量养 GitHub 号 | 脚本换成很多 GitHub 账号 | 账号年龄限制、单账号配额、监控每天新注册的用户数 |
| 附件被丢弃 | 少数 agent 需要附件 | 文档写明；以后有需要再说 |
| GitHub 不可用 | 没法登录 | 已经登录的用户靠刷新令牌不受影响 |

## 14. 需要你操作或决定的事

1. **建 GitHub OAuth App**：Homepage 填 `https://smails.dev`，回调地址填 `https://smails.dev/oauth/github/callback`。
2. **确认默认参数**：免费档每天 20 个邮箱、邮箱有效期 7 天、邮件不删除（过期邮箱读不到）、D1 只存元数据、GitHub 账号年龄至少 30 天。
3. **确认不保存附件。**
4. **确认旧接口直接返回 410**，不给过渡期。
5. 收款以后再说。现在只预留 `plan` 字段，你有没有意见？

## 15. 技术栈与工程约定

原则：**全部使用最新、最现代的方案，工程上照搬 smail.pw（`/Users/zwz/dev/personal/smail/main`）。** 动手前先读 smail 的 `AGENTS.md`，以及各个库随包发布的文档；不凭记忆写用法。

### 15.1 版本（2026-11-05 查的 npm dist-tags，开工时再查一次）

| 用途 | 包 | 版本 / 标签 | 说明 |
| --- | --- | --- | --- |
| 前端框架 | `solid-js`、`@solidjs/web` | `2.0.0-rc.21`（`next`） | smail 现在用 rc.18 |
| 路由 | `@solidjs/router` | `2.0.0-next.44`（`next`） | |
| 构建插件 | `@solidjs/vite-plugin` | `3.0.0-next.56`（`latest`） | 注意：这个包的最新版在 `latest` 下，`next` 反而是旧的（smail 的 AGENTS.md 有记录） |
| 预渲染 | `prerender-crawler` | `0.3.0` | `mode: "static"`，全站构建成静态文件 |
| 样式 | `@stylexjs/stylex`、`@stylexjs/unplugin` | `0.19.1` | |
| 构建 | `vite` | `8.3.6` | |
| Worker 构建 | `@cloudflare/vite-plugin` | `2.0.0-beta.v.11`（`beta`） | **已验证**：2.0 直接读取 `cloudflare.config.ts` 并生成类型；1.67 已经去掉了 smail 用的 `experimental.newConfig` |
| 部署 CLI | `cf` | `1.0.0-beta.27` | 不用 wrangler；smail 现在用 beta.20 |
| 语言 | `typescript` | `7.0.2` | 开 `noUncheckedIndexedAccess`、`erasableSyntaxOnly` 等严格选项，和 smail 一致 |
| lint / 格式化 | `oxlint`、`oxfmt` | `1.91.0`、`0.76.0` | 替换掉现在的 Biome |
| 邮件解析 | `postal-mime` | `4.2.0` | |
| MCP | `@modelcontextprotocol/sdk` | `1.32.2` | 用 `WebStandardStreamableHTTPServerTransport`，无状态 + `enableJsonResponse` |
| 测试 | `vitest` | `5.1.0` | **已验证**：`@cloudflare/vitest-pool-workers` 0.23 要求 vitest ^4.1，不用它。纯逻辑直接用 vitest 测；需要 D1、R2、DO 的部分在 `globalSetup` 里启动 Vite 开发服务器（真实的 workerd + 本地 D1），测试直接发 HTTP 请求 |
| 包管理 | `pnpm` | `12.16.1` | workspace |
| 运行时 | Node | `>= 22.18` | 和 smail 一致 |

### 15.2 仓库结构

```
smails/
├─ site.config.ts          域名、Worker 名、D1 和 R2 的名字与 id，只写在这一处（照搬 smail）
├─ web/                    前端：Solid 2 + StyleX，预渲染成纯静态的 dist/client
├─ worker/                 Worker：cloudflare.config.ts + cf CLI；手写 fetch 路由，不用 Hono
│  ├─ src/contract.ts      接口的数据结构，前端、Worker、CLI 共用，不依赖任何模块
│  ├─ migrations/          core 库和 mail 库的 SQL 迁移，不用 ORM
│  └─ d1.mjs               运维脚本：查用户、封禁、看用量（照搬 smail 的做法）
├─ cli/                    @smails/cli：CLI + 本地 MCP（stdio，转发到远程 /mcp）
└─ docs/
```

### 15.3 约定

- **配置**：Worker 配置写在 `worker/cloudflare.config.ts`，用 `bindings.d1`、`bindings.r2`、`bindings.secret()`、`exports.durableObject(...)` 声明；不再有 `wrangler.jsonc`。
- **密钥**：本地开发放 `worker/.env`（不进 git，提交一份 `.env.example`）；首次部署用 `cf deploy --prebuilt --secrets-file .env.production`；以后轮换密钥用 `cf` 的命令。
- **网页会话**：签名 cookie，格式照搬 smail 的 `session.ts`（`base64(JSON).HMAC`，多个密钥用逗号分隔，可以轮换）。只存用户 id 和过期时间，30 天有效，`HttpOnly`、`Secure`、`SameSite=Lax`；所有非 GET 请求都校验 `Origin`。这个 cookie 只在 smails.dev 的网页上用，API 和 MCP 只认 Bearer 令牌。
- **登录相关页面**：Device Login 确认页、OAuth 授权确认页、账号页都做在前端里（静态页面，调用 Worker 的 JSON 接口）；用 `public/_headers` 给这几个页面加 `Content-Security-Policy: frame-ancestors 'none'`。
- **Worker 只处理** `/api/*`、`/mcp`、`/.well-known/*`、OAuth 端点和收信；其余全部是静态文件，不经过 Worker。
- **远程 MCP**：每个请求新建一个 `McpServer` 加一个无状态的传输层，不开会话，不用 Cloudflare `agents` 包（它的 `McpAgent` 每个会话都会开一个 DO）。
- **本地 MCP**：只做转发，把 stdio 收到的 JSON-RPC 原样转给 `https://smails.dev/mcp`，带上本地保存的令牌；本地只额外实现 `login` 工具。工具逻辑只在服务端写一份。
- **日志**：跟 smail 一样关掉调用日志，只保留 issues。
- **没有 staging**：上线前用本地开发服务器（真实的 workerd）加真实的 MCP 客户端测 OAuth，`/__dev/login` 让本地测试不需要 GitHub App。
- **提交前检查**：`pnpm run check` = 类型检查 + oxlint + oxfmt 检查。CI 跑同一条命令。
