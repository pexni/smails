import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { GITHUB_URL } from "~/components/site-chrome";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { FaqItem } from "~/lib/seo";

/**
 * A schema.org JSON-LD <script> for the given @graph. Nodes are built with the
 * helpers in ~/lib/seo (breadcrumbList, faqPage, …) plus a per-page article node.
 */
export function JsonLd({ graph }: { graph: unknown[] }) {
  const data = { "@context": "https://schema.org", "@graph": graph };
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted JSON-LD built from static data
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/** Top-of-page breadcrumb: smails / <label>. */
export function Breadcrumb({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="pt-10 text-xs text-muted-foreground">
      <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="size-3" />
        smails
      </Link>
      <span className="mx-2">/</span>
      <span className="text-foreground">{label}</span>
    </nav>
  );
}

/** Bulleted list with a success check mark per item. */
export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm sm:text-base">
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered (1, 2, 3 …) ordered list of steps. */
export function NumberedSteps({ items }: { items: string[] }) {
  return (
    <ol className="mt-6 space-y-4">
      {items.map((step, i) => (
        <li key={step} className="flex gap-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium">
            {i + 1}
          </span>
          <p className="pt-1 text-sm text-muted-foreground sm:text-base">{step}</p>
        </li>
      ))}
    </ol>
  );
}

/** The "FAQ" section with an accordion of question/answer items. */
export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="pt-16 sm:pt-20">
      <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
      <Card className="mt-6 gap-0 p-0">
        <Accordion multiple={false} className="w-full">
          {items.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="px-5">
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </section>
  );
}

/** Closing call-to-action card with the fixed Open-smails / GitHub buttons. */
export function CtaSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-16 pb-8 sm:pt-20">
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{children}</p>
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
  );
}
