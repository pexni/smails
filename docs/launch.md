# 上线清单

按顺序做。标 **⚠** 的是改了就回不去、或者会影响线上的步骤。命令都在 `worker/` 目录下运行，`cf` 用的是本机的登录（`pnpm exec cf auth whoami` 确认）。

## 0. 合并到 main 之前

- [x] **⚠ 关掉 Workers Builds 的自动部署。**（2026-11-05 已删除 `smails` 的构建触发器；原配置是推送 `main` 时在 `worker/` 下执行 `cd ../frontend && pnpm build` 和 `npx wrangler deploy`。） 现在推送到 `main` 会触发 Cloudflare Workers Builds，它还在用旧的构建命令（进 `frontend/`、用 wrangler），合并后会构建失败。失败时线上仍是旧版本，不会坏，但要在合并前处理：控制台 → Workers → smails → Settings → Builds → 断开仓库。以后像 smail.pw 一样用 `pnpm run deploy` 手动部署。
- [x] **建 GitHub OAuth App**（已建在 `pexni` 组织下，Client ID `Ov23lilxxmQ6hLsZXebt`，Secret 已写进 `.env.production`。只用来确认身份，不需要任何权限，不用开 Device Flow）：Homepage `https://smails.dev`，回调 `https://smails.dev/oauth/github/callback`。建议建在 `pexni` 组织名下。把 Client ID 和 Client Secret 填进 `worker/.env.production`。
- [x] 线上资源已建好，id 已写进 `site.config.ts`：D1 `smails-core`、`smails-mail`（表结构已经迁移好），R2 `smails-mail`。
- [x] `worker/.env.production` 已生成，5 个密钥都已填好。这个文件不进 git，**另外存一份到密码管理器**：
  - `ADDR_SECRET` 丢了或换了，之前发出去的所有地址都收不到信；
  - `TOKEN_SECRETS` / `SESSION_SECRETS` 换掉会让所有人重新登录（要轮换时在左边加新的、保留旧的）。

## 1. 本地用真实的 MCP 客户端测一遍

没有 staging 环境：本地开发服务器跑的是真实的 workerd，`/mcp`、OAuth、确认页都在本地，用 `/__dev/login` 登录就不需要 GitHub App。

- [ ] 起本地服务：

  ```bash
  pnpm --filter smails-web run build
  pnpm --filter smails-worker run dev        # http://localhost:8792
  ```

- [ ] 在浏览器里先登录一个测试用户：`http://localhost:8792/__dev/login?login=you&next=/account`
- [ ] 把 `http://localhost:8792/mcp` 加到 Claude Code 和 Codex 里，让它们各自走一遍授权（弹出的确认页上点 Allow），再调用 `create_mailbox`：
  - Claude Code：`claude mcp add --transport http smails-local http://localhost:8792/mcp`
  - Codex：`codex mcp add smails-local --url http://localhost:8792/mcp`，再 `codex mcp login smails-local`
  - 顺便核对 `/docs/mcp` 上各客户端的配置写法和实际操作是否一致。
- [ ] 模拟收信，确认 `wait_for_message` 能收到：

  ```bash
  printf 'From: a@example.com\r\nTo: <地址>\r\nSubject: Your code\r\nMessage-ID: <1@example.com>\r\n\r\nCode 123456\r\n' \
    | curl -X POST "http://localhost:8792/cdn-cgi/local/email?from=a@example.com&to=<地址>" --data-binary @-
  ```

## 2. 正式部署

- [ ] **⚠ 部署**：

  ```bash
  pnpm run deploy:first      # 构建、执行迁移、部署，并带上 .env.production 里的密钥
  ```

  部署输出里应该看到：`InboxHub` 是新建的 namespace，`Mailbox` 保持不变（它原来是 `new_sqlite_classes`，对应 `storage: "sqlite"`，Cloudflare 文档说明这种切换不迁移数据）。**如果输出里说要删除或重建 `Mailbox`，立刻停下来。**

  从这一刻起，旧的匿名接口返回 410，那个批量注册脚本就被挡住了。
- [ ] 部署后马上检查：

  ```bash
  curl -si -X POST https://smails.dev/api/mailbox | head -1                      # 410
  curl -s https://smails.dev/.well-known/oauth-authorization-server | jq .issuer   # "https://smails.dev"
  ```

  然后用本地构建的 CLI 跑一遍：`login` → `create` → 用自己的邮箱给这个地址发一封信 → `wait` 收到。
- [ ] 第二天看数据（Cloudflare GraphQL，或者控制台）：`POST /api/mailbox` 基本都是 410；Worker 请求数和 DO 请求数大幅下降。`pnpm run stats` 看真实用户的用量。

## 3. 发布 CLI 和 MCP 注册表

worker 先上线，再发 CLI：CLI 0.1 只能连新的服务器。

- [ ] 合并 `rewrite` 到 `main`（这时自动部署已经关掉了）。
- [ ] `gh release create cli-v0.1.0 --target main --title "CLI 0.1.0" --notes "Sign-in required; see the README."`

  发布流程会把 `@smails/cli@0.1.0` 发到 npm，再用 `server.json` 更新 MCP 注册表（这次新增了远程地址 `https://smails.dev/mcp`）。
- [ ] 确认 `npx @smails/cli@latest --version` 是 0.1.0，注册表上的条目里有远程服务器。

## 4. 之后

- [ ] **WAF 规则**：现在那条"每个 IP 每 10 秒 2 次"的规则管的是 `/api/mailbox`，这个接口已经只回 410 了。可以改成限制会被滥用的新接口：`/device/code`、`/register`（这两个不用登录就能调，每次都写一行 D1）。
- [ ] **⚠ 第 7–8 天：删掉旧的 `Mailbox` DO。** 先确认旧数据已经清空：每个旧 DO 都有一个 7 天的 alarm，到点会自己删数据。用 GraphQL 的 `durableObjectsSqlStorageGroups` 看存储量是否已经从 137 GB 降到接近 0。然后：
  1. `cloudflare.config.ts` 里把 `Mailbox` 改成 `exports.durableObject({ state: "deleted" })`；
  2. 删掉 `src/legacy.ts` 里的 `Mailbox` 类和 `index.ts` 里的导出（`legacyApi` 留着，旧接口继续回 410）；
  3. 部署。**这一步不可逆，namespace 和里面剩下的数据会一起删掉。**

## 回滚

- 用了 `exports` 部署之后，就不能再回到旧的 `migrations` 写法；而且版本之间如果 DO 的 namespace 不一样，Cloudflare 可能不允许直接回滚到旧版本。所以**回滚到重写之前的旧版本不一定能做到**，这正是要先在本地用真实客户端把流程跑通（第 1 步）的原因。
- 新版本之间的回滚：`pnpm exec cf workers versions list` 找到版本，再 `pnpm exec cf workers deployments create` 把流量切回去。
- 新建的 D1 库和 R2 桶对旧版本没有影响；旧的 DO 数据在新版本上线后只会被 alarm 逐步删除，删掉的部分回滚也找不回来。
