import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Copy, RefreshCw, Plus, ArrowLeft, ArrowDown, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { Route } from "./+types/home"
import { cn } from "~/lib/utils"
import { formatTime, initials } from "~/lib/format"
import {
  type Email,
  type EmailDetail as EmailDetailType,
  getToken,
  getAddress,
  clearAuth,
  createMailbox,
  listMessages,
  getMessage,
  deleteMessage,
} from "~/lib/api"
import { useWebSocket, type WsStatus } from "~/hooks/use-websocket"
import { CodeBlock } from "~/components/code-block"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"

export function meta(_: Route.MetaArgs) {
  const url = "https://smails.dev/"
  const title = "smails — disposable email for humans & agents"
  const description =
    "An instant throwaway inbox for sign-ups, codes, and confirmations — with a REST API, CLI, and MCP server so your agents can read it too. No signup."
  const image = "https://smails.dev/og.png"
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: "smails" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "smails — disposable email for humans and agents" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: "smails — disposable email for humans and agents" },
  ]
}

const GITHUB_URL = "https://github.com/pexni/smails"
const NPM_URL = "https://www.npmjs.com/package/@smails/cli"

const CLI_CODE = `# create a mailbox
npx @smails/cli create

# list and read messages
npx @smails/cli inbox
npx @smails/cli read <id>`

const MCP_CODE = `{
  "mcpServers": {
    "smails": {
      "command": "npx",
      "args": ["@smails/cli", "mcp"]
    }
  }
}`

const MCP_TOOLS = [
  "create_mailbox",
  "list_messages",
  "read_message",
  "delete_message",
  "get_address",
]

const API_CODE = `# create a mailbox
curl -X POST https://smails.dev/api/mailbox
# → { "address": "...", "token": "..." }

# list messages with the returned token
curl https://smails.dev/api/mailbox/messages \\
  -H "Authorization: Bearer <token>"

# read one message (full parsed body)
curl https://smails.dev/api/mailbox/messages/<id> \\
  -H "Authorization: Bearer <token>"`

const ENDPOINTS: { method: string; path: string; desc: string }[] = [
  { method: "POST", path: "/api/mailbox", desc: "Create a mailbox → { address, token }" },
  { method: "GET", path: "/api/mailbox/messages", desc: "List messages" },
  { method: "GET", path: "/api/mailbox/messages/:id", desc: "Read a message (full body)" },
  { method: "DELETE", path: "/api/mailbox/messages/:id", desc: "Delete a message" },
  { method: "WS", path: "/api/mailbox/connect", desc: "Stream new-mail notifications" },
]

const FAQ = [
  {
    q: "Is it free?",
    a: "Completely. No account, no paywall, no card.",
  },
  {
    q: "Can agents use it?",
    a: "Yes — that's the point. Drive any mailbox from the CLI, the REST API, or the built-in MCP server.",
  },
  {
    q: "How long does my address last?",
    a: "As long as you keep using it. No countdown. Hit + for a fresh one whenever.",
  },
  {
    q: "Can I reply or send mail?",
    a: "Not yet. Receive only — verification codes, confirmation links, the stuff you never want in your real inbox.",
  },
  {
    q: "Is anyone reading my mail?",
    a: "We don't ask who you are and we don't track you.",
  },
]

function buildWsUrl(token: string | null): string | null {
  if (!token || typeof window === "undefined") return null
  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${location.host}/api/mailbox/connect?token=${token}`
}

export default function Home() {
  const [address, setAddress] = useState<string>("")
  const [emails, setEmails] = useState<Email[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EmailDetailType | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId

  const fetchMessages = useCallback(async () => {
    const msgs = await listMessages()
    setEmails(msgs)
  }, [])

  const wsUrl = useMemo(() => buildWsUrl(token), [token])

  const { status: wsStatus } = useWebSocket({
    url: wsUrl,
    onMessage: (data) => {
      if (data && typeof data === "object" && "type" in data && (data as { type: string }).type === "new_email") {
        fetchMessages()
      }
    },
  })

  useEffect(() => {
    async function init() {
      try {
        const existingToken = getToken()
        const addr = getAddress()
        let needsNewMailbox = !existingToken || !addr
        if (existingToken && addr) {
          try {
            setAddress(addr)
            setToken(existingToken)
            await fetchMessages()
          } catch {
            clearAuth()
            needsNewMailbox = true
          }
        }
        if (needsNewMailbox) {
          const result = await createMailbox()
          setAddress(result.address)
          setToken(result.token)
        }
      } catch {
        toast.error("Failed to initialize. Please refresh the page.")
      } finally {
        setLoaded(true)
      }
    }
    init()
  }, [fetchMessages])

  const selected = emails.find((e) => e.id === selectedId) ?? null
  const unreadCount = emails.filter((e) => !e.read).length

  function copyAddress() {
    navigator.clipboard.writeText(address).then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy"),
    )
  }

  async function handleNewAddress() {
    try {
      const result = await createMailbox()
      setAddress(result.address)
      setToken(result.token)
      setEmails([])
      setSelectedId(null)
      setDetail(null)
      toast.success("New mailbox created")
    } catch {
      toast.error("Failed to create mailbox")
    }
  }

  async function handleRefresh() {
    try {
      await fetchMessages()
      toast.success("Refreshed")
    } catch {
      toast.error("Failed to refresh")
    }
  }

  async function openEmail(email: Email) {
    const targetId = email.id
    setSelectedId(targetId)
    setDetail(null)
    if (!email.read) {
      setEmails((prev) =>
        prev.map((e) => (e.id === targetId ? { ...e, read: 1 } : e)),
      )
    }
    try {
      const msg = await getMessage(targetId)
      if (selectedIdRef.current === targetId) {
        setDetail(msg)
      }
    } catch {
      toast.error("Failed to load message")
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMessage(id)
      setEmails((prev) => prev.filter((e) => e.id !== id))
      if (selectedIdRef.current === id) {
        setSelectedId(null)
        setDetail(null)
      }
      toast.success("Deleted")
    } catch {
      toast.error("Failed to delete")
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <StructuredData />
      <Nav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section id="top" className="scroll-mt-16 pt-16 text-center sm:pt-24">
          <Badge variant="secondary">Agent-native · No signup · Free</Badge>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Disposable email for humans and agents.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground text-balance sm:text-lg">
            An instant throwaway inbox for sign-ups, codes, and confirmations —
            with a REST API, CLI, and MCP server so your agents can read it too.
          </p>
          <div className="mt-8 flex justify-center">
            <Button render={<a href="#inbox" />}>
              Get my inbox
              <ArrowDown />
            </Button>
          </div>
        </section>

        <section id="inbox" aria-labelledby="inbox-heading" className="scroll-mt-16 pt-12 sm:pt-16">
          <Mailbox
            address={address}
            emails={emails}
            loading={!loaded}
            selected={selected}
            detail={detail}
            selectedId={selectedId}
            unreadCount={unreadCount}
            wsStatus={wsStatus}
            onNew={handleNewAddress}
            onRefresh={handleRefresh}
            onCopy={copyAddress}
            onOpen={openEmail}
            onBack={() => {
              setSelectedId(null)
              setDetail(null)
            }}
            onDelete={handleDelete}
          />
        </section>

        <ForAgents />
        <ApiSection />
        <Faq />
      </main>

      <Footer />
    </div>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <a href="#top" className="font-mono text-sm font-semibold tracking-tight">
          smails<span className="text-muted-foreground">.dev</span>
        </a>
        <nav className="flex items-center gap-5 text-xs text-muted-foreground">
          <a href="#agents" className="hidden transition-colors hover:text-foreground sm:inline">
            Agents
          </a>
          <a href="#api" className="hidden transition-colors hover:text-foreground sm:inline">
            API
          </a>
          <a href="#faq" className="hidden transition-colors hover:text-foreground sm:inline">
            FAQ
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="transition-colors hover:text-foreground"
          >
            <GithubIcon className="size-4" />
          </a>
        </nav>
      </div>
    </header>
  )
}

function Mailbox({
  address,
  emails,
  loading,
  selected,
  detail,
  selectedId,
  unreadCount,
  wsStatus,
  onNew,
  onRefresh,
  onCopy,
  onOpen,
  onBack,
  onDelete,
}: {
  address: string
  emails: Email[]
  loading: boolean
  selected: Email | null
  detail: EmailDetailType | null
  selectedId: string | null
  unreadCount: number
  wsStatus: WsStatus
  onNew: () => void
  onRefresh: () => void
  onCopy: () => void
  onOpen: (e: Email) => void
  onBack: () => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="inbox-heading" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your live inbox
          </h2>
          <code
            aria-label={address ? `Your inbox address: ${address}` : "Your inbox address"}
            className="mt-1 block min-w-0 truncate font-mono text-lg font-semibold sm:text-2xl"
          >
            {address || " "}
          </code>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction label="New address" onClick={onNew}>
            <Plus />
          </IconAction>
          <IconAction label="Refresh" onClick={onRefresh}>
            <RefreshCw />
          </IconAction>
          <Button size="sm" onClick={onCopy} className="ml-1">
            <Copy />
            <span className="hidden sm:inline">Copy</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {emails.length} message{emails.length === 1 ? "" : "s"}
          {unreadCount > 0 && (
            <span className="text-foreground"> · {unreadCount} unread</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              wsStatus === "connected" && "animate-pulse bg-success",
              wsStatus === "connecting" && "animate-pulse bg-muted-foreground",
              wsStatus === "disconnected" && "bg-muted-foreground",
            )}
          />
          {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting" : "Offline"}
        </span>
      </div>

      <div className="grid h-[28rem] grid-cols-1 sm:h-[36rem] md:grid-cols-[minmax(260px,330px)_1fr]">
        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col border-border md:border-r",
            selected && "hidden md:flex",
          )}
        >
          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <ul className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </ul>
            ) : emails.length === 0 ? (
              <EmptyInbox />
            ) : (
              <ul className="divide-y divide-border">
                {emails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    active={email.id === selectedId}
                    onClick={() => onOpen(email)}
                  />
                ))}
              </ul>
            )}
          </ScrollArea>
        </aside>

        <section className={cn("min-h-0 min-w-0", !selected && "hidden md:block")}>
          {selected ? (
            <EmailDetail
              email={selected}
              detail={detail}
              onBack={onBack}
              onDelete={() => onDelete(selected.id)}
            />
          ) : (
            <EmptyDetail />
          )}
        </section>
      </div>
    </Card>
  )
}

function ForAgents() {
  return (
    <section id="agents" className="scroll-mt-16 pt-24 text-center sm:pt-32">
      <Badge variant="secondary">For agents & CLI</Badge>
      <h2 className="mx-auto mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
        Give your agent its own inbox.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
        Humans and agents share the same mailbox. Drive it from the terminal, or
        plug the MCP server into Claude, Cursor, or any MCP client.
      </p>

      <div className="mt-10 grid gap-5 text-left md:grid-cols-2 md:items-stretch">
        <CodeBlock label="terminal" code={CLI_CODE} />
        <CodeBlock label="~/.claude/mcp.json" code={MCP_CODE} />
      </div>

      <Card size="sm" className="mx-auto mt-5 max-w-xl text-center">
        <CardHeader>
          <CardTitle>MCP Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-2">
            {MCP_TOOLS.map((t) => (
              <code
                key={t}
                className="border border-border bg-muted px-2 py-1 font-mono text-xs"
              >
                {t}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function ApiSection() {
  return (
    <section id="api" className="scroll-mt-16 pt-24 text-center sm:pt-32">
      <Badge variant="secondary">REST API</Badge>
      <h2 className="mx-auto mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
        Or just call the API.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
        No SDK required. Create a mailbox, then poll or stream messages with the
        returned token.
      </p>

      <div className="mt-10 grid items-stretch gap-5 text-left md:grid-cols-2">
        <CodeBlock label="curl" code={API_CODE} />
        <Card className="gap-0 p-0">
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Endpoints
            </span>
          </div>
          {ENDPOINTS.map((e, i) => (
            <div
              key={e.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i > 0 && "border-t border-border",
              )}
            >
              <span className="inline-flex w-14 shrink-0 items-center justify-center bg-muted py-1 font-mono text-xs font-medium text-foreground">
                {e.method}
              </span>
              <div className="min-w-0">
                <code className="block truncate font-mono text-xs text-foreground">{e.path}</code>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.desc}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 pt-24 pb-24 text-center sm:pt-32">
      <Badge variant="secondary">FAQ</Badge>
      <h2 className="mx-auto mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
        Everything you might be wondering.
      </h2>
      <Card className="mx-auto mt-10 max-w-2xl gap-0 p-0 text-left">
        <Accordion multiple={false} className="w-full">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="px-5">
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 py-12 text-center">
        <p className="font-mono text-sm font-semibold">
          smails<span className="text-muted-foreground">.dev</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Disposable email for humans and agents.
        </p>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <a href={NPM_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            npm
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

function EmailListItem({
  email,
  active,
  onClick,
}: {
  email: Email
  active: boolean
  onClick: () => void
}) {
  const isRead = !!email.read
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
          active && "bg-muted",
        )}
      >
        <Avatar className="mt-0.5 size-8 shrink-0">
          <AvatarFallback>{initials(email.from_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                isRead ? "text-muted-foreground" : "font-semibold",
              )}
            >
              {!isRead && <span className="sr-only">Unread. </span>}
              {email.from_name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(email.received_at)}
            </span>
          </div>
          <p className={cn("truncate text-sm", !isRead && "font-medium")}>
            {email.subject}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {email.preview}
          </p>
        </div>
        {!isRead && (
          <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
        )}
      </button>
    </li>
  )
}

function EmailDetail({
  email,
  detail,
  onBack,
  onDelete,
}: {
  email: Email
  detail: EmailDetailType | null
  onBack: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {email.subject}
        </h2>
        <IconAction label="Delete" onClick={onDelete}>
          <Trash2 />
        </IconAction>
      </div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Avatar className="size-9">
          <AvatarFallback>{initials(email.from_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{email.from_name}</p>
          <p className="truncate text-xs text-muted-foreground">{email.from_addr}</p>
        </div>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {formatTime(email.received_at)}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {detail?.html ? (
          <iframe
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid:;">${detail.html}`}
            title="Email content"
            className="h-full w-full border-0"
          />
        ) : (
          <div
            aria-busy={!detail}
            aria-live="polite"
            className="whitespace-pre-wrap px-4 py-5 text-sm leading-relaxed"
          >
            {!detail ? "Loading…" : detail.text || "This message has no content."}
          </div>
        )}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 py-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-2.5 w-32 max-w-full" />
      </div>
    </li>
  )
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
      <p className="text-sm font-medium">Nothing here yet</p>
      <p className="text-xs text-muted-foreground">
        New mail lands here on its own.
      </p>
    </div>
  )
}

function EmptyDetail() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Select a message to read it.
      </p>
    </div>
  )
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            aria-label={label}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.082 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.282.76-1.577-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209.96-.262 1.98-.392 3-.398 1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.561C20.565 21.917 24 17.495 24 12.292 24 5.78 18.63.5 12 .5z" />
    </svg>
  )
}

function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "smails",
        applicationCategory: "CommunicationApplication",
        operatingSystem: "Web",
        description:
          "A free disposable email address with a REST API, CLI, and MCP server. Receive emails in real time with no sign-up.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
