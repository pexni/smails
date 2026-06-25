import { Link } from "react-router";
import { cn } from "~/lib/utils";

export const GITHUB_URL = "https://github.com/pexni/smails";
export const NPM_URL = "https://www.npmjs.com/package/@smails/cli";

type PageKey = "mcp" | "api" | "otp";

const NAV_LINKS: { key: PageKey; to: string; label: string }[] = [
  { key: "mcp", to: "/mcp", label: "MCP" },
  { key: "api", to: "/email-api", label: "API" },
  { key: "otp", to: "/otp", label: "Codes" },
];

/** Sticky header for the standalone content pages (MCP / API / Codes). */
export function ContentNav({ current }: { current?: PageKey }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link to="/" className="font-mono text-sm font-semibold tracking-tight">
          smails<span className="text-muted-foreground">.dev</span>
        </Link>
        <nav className="flex items-center gap-5 text-xs text-muted-foreground">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.key}
              to={l.to}
              className={cn(
                "transition-colors hover:text-foreground",
                current === l.key && "text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

/** Shared footer with site-wide internal links — used on every page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-12 text-center">
        <Link to="/" className="font-mono text-sm font-semibold">
          smails<span className="text-muted-foreground">.dev</span>
        </Link>
        <p className="text-sm text-muted-foreground">Disposable email for humans and agents.</p>
        <nav className="flex flex-wrap items-center justify-center gap-5 text-sm text-muted-foreground">
          <Link to="/mcp" className="transition-colors hover:text-foreground">
            MCP server
          </Link>
          <Link to="/email-api" className="transition-colors hover:text-foreground">
            REST API
          </Link>
          <Link to="/otp" className="transition-colors hover:text-foreground">
            Verification codes
          </Link>
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            npm
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
