# AGENTS.md

本文件为 AI 编码助手提供本项目的约定与上下文。请在改动代码前阅读。

## 项目简介

Smail 的前端，基于 **React Router 8（框架模式）** 构建。**不开 SSR**（`ssr: false`），改用**预渲染（`prerender: true`）**：构建时把路由生成静态 HTML，运行时按 SPA 方式工作。

## 技术栈

- **框架**：React Router 8（框架模式，`ssr: false` + `prerender: true`，预渲染 SPA）
- **运行时**：React 19
- **构建工具**：Vite 8
- **样式**：Tailwind CSS v4（通过 `@tailwindcss/vite` 插件，无 `tailwind.config`，配置写在 `app/app.css`）
- **UI 组件**：shadcn（`base-sera` 风格），底层基于 **Base UI**（`@base-ui/react`），**不是** Radix
- **图标**：lucide-react
- **类型**：TypeScript（`strict` 模式）
- **包管理器**：**pnpm**（存在 `pnpm-lock.yaml`，请勿使用 npm / yarn）

## 常用命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 生产构建（产出 build/client 静态资源 + 预渲染 HTML）
pnpm start        # react-router-serve 运行构建产物（已验证可用）
pnpm typecheck    # 生成路由类型并运行 tsc 类型检查
```

改动后请运行 `pnpm typecheck` 验证类型。本项目目前未配置 lint / test。

**部署**：构建产物是预渲染好的静态站点。既可以用 `pnpm start`（react-router-serve）托管，也可以直接把 `build/client`（含 `index.html`、`__spa-fallback.html`）当静态资源部署到任意静态托管/CDN。

## 目录结构

```
app/
  root.tsx              # 根布局、<Layout>、ErrorBoundary
  routes.ts             # 路由配置（集中式，非文件路由）
  routes/               # 路由组件
  components/ui/         # shadcn UI 组件
  lib/utils.ts          # 工具函数（含 cn()）
  app.css               # 全局样式 + Tailwind 配置
react-router.config.ts  # React Router 配置
components.json         # shadcn 配置
```

## 约定

- **路径别名**：用 `~/*` 指向 `app/*`（如 `import { cn } from "~/lib/utils"`）。
- **路由**：在 `app/routes.ts` 中集中声明路由，新增页面需在此注册，**不是**约定式文件路由。
- **路由类型**：每个路由用 `import type { Route } from "./+types/<name>"` 引入自动生成的类型；这些类型由 `react-router typegen` 生成，跑 `pnpm typecheck` 或 `pnpm dev` 时会自动更新。
- **className 合并**：始终用 `cn()`（`clsx` + `tailwind-merge`）拼接类名。
- **UI 组件优先用 shadcn**：为保持风格统一，能用 shadcn 现成组件就不要自己手写。先看 `app/components/ui/` 是否已有；没有则用 `pnpm shadcn add <组件>` 添加（shadcn 已装在 devDependencies，无需 dlx；风格 `base-rhea`，落到 `app/components/ui/`）。只有 shadcn 确实没有对应组件时，才基于现有 UI 组件和 Base UI 自行封装。注意底层是 Base UI，不要引入 Radix 依赖。
- **不要过度自定义样式（重要）**：一律用 shadcn 默认组件样式 + 主题 token，外观由主题统一控制。**禁止**在页面里写死圆角（`rounded-xl`、`rounded-[1px]`）、硬编码颜色（`bg-amber-300`、`bg-emerald-500`）、加装饰性自定义元素（光晕、荧光笔等）。原因：散落的自定义类会让换主题不生效、出问题无法排查。要调外观就改 `app/app.css` 的 token，不在组件里覆盖。
- **主题/配色**：颜色、圆角（`--radius`）、字体都集中在 `app/app.css` 的 CSS 变量里，**整套主题用 `pnpm dlx shadcn@latest apply --preset <id>` 切换**，效果应完全由 app.css 决定。组件里只引用语义 token（`bg-primary`、`text-foreground`、`text-muted-foreground`、`bg-muted`、`bg-card`、`border-border` 等），不写具体色值。
- **组件写法**：函数组件，组件变体用 `class-variance-authority`（`cva`）定义，可参考 `app/components/ui/button.tsx`。

## 注意事项

- **不开 SSR，走预渲染（SPA）**：没有运行时服务端渲染。取数请用 `clientLoader` / `clientAction`（运行时在浏览器执行）；普通 `loader`/`action` 只在构建时跑一次产出静态数据，**不要在其中写依赖每次请求上下文的逻辑**。动态数据交互一律走客户端 fetch / API 调用。
- 预渲染要求构建时能枚举到目标路由；新增动态路由时确认 `prerender` 是否需要显式列出路径。
- 浏览器专属 API（`window`、`document` 等）在预渲染（构建时）阶段不可用，使用前需做环境判断。
- 修改路由后，类型文件需重新生成才能消除类型报错。
