import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router";
import { CodeBlock } from "~/components/code-block";
import { ContentNav, GITHUB_URL, SiteFooter } from "~/components/site-chrome";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { Route } from "./+types/mcp";

export function meta(_: Route.MetaArgs) {
  const url = "https://smails.dev/mcp";
  const title = "Free disposable email MCP server — no API key, no signup | smails";
  const description =
    "A free MCP server that gives your AI agent its own disposable inbox — no API key, no signup. Plug it into Claude, Cursor, or any MCP client and the agent creates a mailbox and reads verification codes and magic links on its own. Receive-only.";
  const image = "https://smails.dev/og.png";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "article" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: "smails" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    {
      property: "og:image:alt",
      content: "smails — free disposable email MCP server for AI agents",
    },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}

const CLAUDE_CODE_CMD = `claude mcp add smails -- npx -y @smails/cli mcp`;

const MCP_JSON = `{
  "mcpServers": {
    "smails": {
      "command": "npx",
      "args": ["@smails/cli", "mcp"]
    }
  }
}`;

const DIFFERENTIATORS = [
  "No API key — the agent provisions its own mailbox at runtime.",
  "No signup, no account, no card. Free.",
  "Same mailbox across MCP, CLI, REST API, and the web — watch what your agent receives.",
  "Runs over stdio via npx — nothing to install or host.",
];

const TOOLS: { name: string; desc: string }[] = [
  {
    name: "create_mailbox",
    desc: "Create a fresh disposable address and start receiving — no key.",
  },
  { name: "get_address", desc: "Return the agent's current mailbox address." },
  { name: "list_messages", desc: "List messages in the mailbox (sender, subject, preview)." },
  {
    name: "read_message",
    desc: "Read a message's full parsed body — the agent extracts the code or link.",
  },
  { name: "delete_message", desc: "Delete a message once the agent is done with it." },
];

const FLOW = [
  "Agent calls create_mailbox and gets an address like a8f3@smails.dev.",
  "It pastes that address into the sign-up form it's automating.",
  "The service emails a verification code; smails receives it instantly.",
  "Agent calls list_messages, then read_message, and reads the code straight out of the body.",
  "It submits the code and finishes the flow — no human in the loop.",
];

const FAQ = [
  {
    q: "Does the agent need an API key or signup?",
    a: "No. The mailbox and its token are created on demand by the create_mailbox tool. There's no account, no key, and nothing to configure beyond adding the server. That's the main thing that sets smails apart from key-gated MCP email servers.",
  },
  {
    q: "Which MCP clients work?",
    a: "Any MCP client. The server runs over stdio via npx, so Claude Desktop, Claude Code, Cursor, and others all work with the same config.",
  },
  {
    q: "Does it extract the verification code for me?",
    a: "It returns the full parsed message; the agent reads the code or magic link out of the body — something LLM agents do reliably. For scripts, parse the returned text or HTML.",
  },
  {
    q: "Can a human see the same inbox?",
    a: "Yes. The CLI, the REST API, the MCP server, and the website all drive the same mailbox, so you can watch what your agent receives.",
  },
  {
    q: "Can the agent send email?",
    a: "Not yet — smails is receive-only. It's built for inbound verification codes, magic links, and confirmations, not outbound or two-way threads.",
  },
];

export default function Mcp() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <StructuredData />
      <ContentNav current="mcp" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5">
        <nav aria-label="Breadcrumb" className="pt-10 text-xs text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3" />
            smails
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">MCP server</span>
        </nav>

        <header className="pt-8 sm:pt-12">
          <Badge variant="secondary">MCP · Free · No API key · No signup</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            A free disposable email MCP server for your AI agent.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Sign-ups and logins gate AI agents behind email verification codes. The smails MCP
            server gives your agent its own throwaway inbox — no API key, no signup — so it can
            create an address and read the codes, magic links, and confirmations it receives on its
            own.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button render={<a href="#setup" />}>Add the server</Button>
            <Button variant="outline" render={<Link to="/" />}>
              Try the web inbox
            </Button>
          </div>
        </header>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Why this one</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Other MCP email servers make you register and pass an API key. smails doesn't.
          </p>
          <ul className="mt-6 space-y-3">
            {DIFFERENTIATORS.map((d) => (
              <li key={d} className="flex gap-3 text-sm sm:text-base">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="setup" className="scroll-mt-16 pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Set it up</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            The server ships with the <code className="font-mono">@smails/cli</code> npm package and
            runs over stdio — no install, no key.
          </p>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Claude Code
          </h3>
          <CodeBlock className="mt-3" label="terminal" code={CLAUDE_CODE_CMD} />

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Claude Desktop / Cursor / any MCP client
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Add this to your MCP config (e.g. <code className="font-mono">~/.claude/mcp.json</code>
            ):
          </p>
          <CodeBlock className="mt-3" label="mcp.json" code={MCP_JSON} />
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Tools the agent gets</h2>
          <Card className="mt-6 gap-0 p-0">
            {TOOLS.map((t, i) => (
              <div
                key={t.name}
                className={i > 0 ? "border-t border-border px-4 py-3" : "px-4 py-3"}
              >
                <code className="font-mono text-sm font-medium text-foreground">{t.name}</code>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </Card>
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            How an agent reads a verification code
          </h2>
          <ol className="mt-6 space-y-4">
            {FLOW.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm text-muted-foreground sm:text-base">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">
            Prefer raw HTTP or a shell? The same flow works over the{" "}
            <Link
              to="/email-api"
              className="font-medium text-foreground underline underline-offset-4"
            >
              REST API
            </Link>{" "}
            and is walked through end to end in{" "}
            <Link to="/otp" className="font-medium text-foreground underline underline-offset-4">
              reading verification codes
            </Link>
            .
          </p>
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <Card className="mt-6 gap-0 p-0">
            <Accordion multiple={false} className="w-full">
              {FAQ.map((item) => (
                <AccordionItem key={item.q} value={item.q} className="px-5">
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </section>

        <section className="pt-16 pb-8 sm:pt-20">
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Give your agent an inbox.</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Open the web app for a live inbox, or wire up the MCP server above and let your agent
              handle email itself.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button render={<Link to="/" />}>Open smails</Button>
              <Button
                variant="outline"
                render={
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                    GitHub
                    <ArrowUpRight />
                  </a>
                }
              />
            </div>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: "A free disposable email MCP server for your AI agent",
        description:
          "How to plug the free, no-key smails MCP server into Claude, Cursor, or any MCP client so your agent can create a disposable mailbox and read verification codes on its own.",
        about: "Model Context Protocol disposable email server",
        url: "https://smails.dev/mcp",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "smails", item: "https://smails.dev/" },
          { "@type": "ListItem", position: 2, name: "MCP server", item: "https://smails.dev/mcp" },
        ],
      },
    ],
  };
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted JSON-LD built from static data
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
