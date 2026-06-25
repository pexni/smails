import { ArrowLeft, ArrowUpRight } from "lucide-react";
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
import type { Route } from "./+types/otp";

export function meta(_: Route.MetaArgs) {
  const url = "https://smails.dev/otp";
  const title = "Get verification codes & OTPs from email — API, CLI & MCP | smails";
  const description =
    "A free disposable inbox for receiving OTPs, verification codes, and magic links — no signup. Read them from the web, the CLI, the REST API, or an MCP server so a script or AI agent can finish a sign-up on its own. Receive-only.";
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
    { property: "og:image:alt", content: "smails — get verification codes from email" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}

const CLI_CODE = `# create a disposable inbox, then read the code
npx @smails/cli create
npx @smails/cli inbox          # see what arrived
npx @smails/cli read <id>      # full body — copy the code`;

const SCRIPT_CODE = `# poll for the code with the REST API
TOKEN=$(curl -sX POST https://smails.dev/api/mailbox | jq -r .token)
# ...use the address, then read the latest message:
curl -s https://smails.dev/api/mailbox/messages \\
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id'
# fetch its body and grep the 6-digit code:
curl -s https://smails.dev/api/mailbox/messages/<id> \\
  -H "Authorization: Bearer $TOKEN" | grep -oE '[0-9]{6}'`;

const STEPS = [
  "Create a disposable mailbox — instantly, with no signup.",
  "Use its address wherever a verification code or magic link is required.",
  "smails receives the email the moment it's sent.",
  "Read the message; pull the code or link out of the body.",
  "An AI agent reads it straight from the text; a script greps or parses it.",
];

const FAQ = [
  {
    q: "Does smails extract the code automatically?",
    a: "It returns the full parsed message — text and HTML. An LLM agent reads the code or magic link directly; a script can grep or regex it. There's no separate key-gated 'get code' endpoint to learn.",
  },
  {
    q: "Is it really free with no signup?",
    a: "Yes. Create a mailbox with one request and start receiving. No account, no API key, no card.",
  },
  {
    q: "Can my script or AI agent do this unattended?",
    a: "That's the point. Use the REST API or the MCP server and an agent can create the inbox, wait for the email, and read the code without a human.",
  },
  {
    q: "Will every service deliver to a disposable address?",
    a: "Most do, but some block known disposable domains. If a code never arrives, the sender likely rejects throwaway addresses — that's a limit of disposable email everywhere, not just smails.",
  },
];

export default function Otp() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <StructuredData />
      <ContentNav current="otp" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5">
        <nav aria-label="Breadcrumb" className="pt-10 text-xs text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3" />
            smails
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Verification codes</span>
        </nav>

        <header className="pt-8 sm:pt-12">
          <Badge variant="secondary">OTP · Magic links · Free · No signup</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Read verification codes and magic links — for scripts and agents.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            A sign-up emails an OTP and the flow stalls — your script or AI agent has no inbox to
            read it from. smails is a free disposable inbox that receives the code, and hands you
            the full message over the web, CLI, REST API, or MCP so you can pull the code out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button render={<Link to="/" />}>Get an inbox</Button>
            <Button variant="outline" render={<a href="#how" />}>
              How it works
            </Button>
          </div>
        </header>

        <section id="how" className="scroll-mt-16 pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm text-muted-foreground sm:text-base">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">From the command line</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Grab a code by hand in three commands.
          </p>
          <CodeBlock className="mt-6" label="terminal" code={CLI_CODE} />
        </section>

        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">In a script</h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Poll the REST API and pull the code out of the body — no key, no signup.
          </p>
          <CodeBlock className="mt-6" label="bash" code={SCRIPT_CODE} />
          <p className="mt-4 text-sm text-muted-foreground">
            Want an agent to do this on its own? The{" "}
            <Link to="/mcp" className="font-medium text-foreground underline underline-offset-4">
              MCP server
            </Link>{" "}
            exposes the same flow as tools, and the full{" "}
            <Link
              to="/email-api"
              className="font-medium text-foreground underline underline-offset-4"
            >
              REST API
            </Link>{" "}
            is documented separately.
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
            <h2 className="text-xl font-semibold tracking-tight">Never wait on a code again.</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Open a disposable inbox and start receiving verification codes in seconds.
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
        "@type": "HowTo",
        name: "Get a verification code or OTP from email with a disposable inbox",
        description:
          "Use a free disposable inbox to receive an OTP, verification code, or magic link and read it from the web, CLI, REST API, or an MCP server.",
        step: STEPS.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
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
          {
            "@type": "ListItem",
            position: 2,
            name: "Verification codes",
            item: "https://smails.dev/otp",
          },
        ],
      },
    ],
  };
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted JSON-LD built from static data
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
