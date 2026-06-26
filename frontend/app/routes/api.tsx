import { Link } from "react-router";
import { CodeBlock } from "~/components/code-block";
import { Breadcrumb, CheckList, CtaSection, JsonLd } from "~/components/content";
import { ContentNav, SiteFooter } from "~/components/site-chrome";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { breadcrumbList, pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/api";

export function meta(_: Route.MetaArgs) {
  return pageMeta({
    url: "https://smails.dev/email-api",
    title: "Free disposable email REST API — no signup, no API key | smails",
    description:
      "A free disposable email REST API: create a mailbox and read incoming messages programmatically. No signup, no API key — one POST returns an address and token. Stream new mail over WebSocket. Built for scripts and AI agents. Receive-only.",
    imageAlt: "smails — free disposable email REST API",
  });
}

const DIFFERENTIATORS = [
  "No API key — POST once and you get an address plus a bearer token.",
  "No signup, no account, no card. Free.",
  "Real-time: stream new mail over WebSocket, or just poll.",
  "Drive the same mailbox from the CLI, the MCP server, or the web.",
];

const CREATE_CODE = `# create a mailbox — no auth, no key
curl -X POST https://smails.dev/api/mailbox
# → {
#   "address": "cool-fox-7a3f9c@smails.dev",
#   "token": "cool-fox-7a3f9c.5f3a9c2e8b1d4a7c6e0f2b9d8a1c3e5f"
# }`;

const READ_CODE = `# list messages with the returned token
curl https://smails.dev/api/mailbox/messages \\
  -H "Authorization: Bearer <token>"

# read one message — full parsed body (text + html)
curl https://smails.dev/api/mailbox/messages/<id> \\
  -H "Authorization: Bearer <token>"`;

const WS_CODE = `// stream new-mail notifications
const ws = new WebSocket(
  "wss://smails.dev/api/mailbox/connect?token=" + token
);
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "new_message") fetchMessages();
};`;

const ENDPOINTS: { method: string; path: string; desc: string; auth: boolean }[] = [
  {
    method: "POST",
    path: "/api/mailbox",
    desc: "Create a mailbox → { address, token }",
    auth: false,
  },
  { method: "GET", path: "/api/mailbox/messages", desc: "List messages", auth: true },
  {
    method: "GET",
    path: "/api/mailbox/messages/:id",
    desc: "Read a message (full parsed body)",
    auth: true,
  },
  { method: "DELETE", path: "/api/mailbox/messages/:id", desc: "Delete a message", auth: true },
  {
    method: "WS",
    path: "/api/mailbox/connect?token=",
    desc: "Stream new-mail notifications",
    auth: true,
  },
];

export default function Api() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <JsonLd
        graph={[
          {
            "@type": "TechArticle",
            headline: "A free disposable email REST API, no key required",
            description:
              "Create a disposable mailbox and read incoming messages programmatically with a free REST API — no signup, no API key. Poll or stream over WebSocket. Built for scripts and AI agents.",
            about: "Disposable email REST API",
            url: "https://smails.dev/email-api",
          },
          breadcrumbList("REST API", "https://smails.dev/email-api"),
        ]}
      />
      <ContentNav current="api" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5">
        <Breadcrumb label="REST API" />

        <header className="pt-8 sm:pt-12">
          <Badge variant="secondary">REST API · Free · No API key · No signup</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            A free disposable email REST API, no key required.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Create a throwaway mailbox and read its mail programmatically. One POST returns an
            address and a token — no signup, no API key. Poll for messages or stream them over a
            WebSocket. Perfect for scripts, tests, and AI agents that need to receive verification
            codes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button render={<a href="#quickstart" />}>Quick start</Button>
            <Button variant="outline" render={<Link to="/mcp" />}>
              Prefer MCP?
            </Button>
          </div>
        </header>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Why this one</h2>
          <CheckList items={DIFFERENTIATORS} />
        </section>

        <section id="quickstart" className="scroll-mt-16 pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Quick start</h2>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            1 · Create a mailbox
          </h3>
          <CodeBlock className="mt-3" label="curl" code={CREATE_CODE} />
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            2 · Read the mail
          </h3>
          <CodeBlock className="mt-3" label="curl" code={READ_CODE} />
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            3 · Or stream it live
          </h3>
          <CodeBlock className="mt-3" label="javascript" code={WS_CODE} />
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Endpoints</h2>
          <Card className="mt-6 gap-0 p-0">
            {ENDPOINTS.map((e, i) => (
              <div
                key={`${e.method} ${e.path}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <span className="inline-flex w-14 shrink-0 items-center justify-center bg-muted py-1 font-mono text-xs font-medium text-foreground">
                  {e.method}
                </span>
                <div className="min-w-0 flex-1">
                  <code className="block truncate font-mono text-xs text-foreground">{e.path}</code>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.desc}</p>
                </div>
                {!e.auth && (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-success">
                    no auth
                  </span>
                )}
              </div>
            ))}
          </Card>
          <p className="mt-4 text-sm text-muted-foreground">
            Authenticate every request except create with{" "}
            <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>. Keep the
            returned token — it's the only credential for the mailbox.
          </p>
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Good to know</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Receive-only</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                smails receives mail — verification codes, magic links, confirmations. It can't send
                or reply, so it's not for two-way threads.
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Self-expiring</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                A mailbox is wiped after 7 days of inactivity. Any request renews it, so active
                inboxes stay alive.
              </p>
            </Card>
          </div>
        </section>

        <CtaSection title="Build with it.">
          Extracting a code in an agent? See{" "}
          <Link to="/otp" className="font-medium text-foreground underline underline-offset-4">
            reading verification codes
          </Link>
          , or plug in the{" "}
          <Link to="/mcp" className="font-medium text-foreground underline underline-offset-4">
            MCP server
          </Link>
          .
        </CtaSection>
      </main>

      <SiteFooter />
    </div>
  );
}
