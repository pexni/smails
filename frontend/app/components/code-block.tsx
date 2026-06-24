import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "~/lib/utils"
import { Card } from "~/components/ui/card"

export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Card className={cn("gap-0 p-0", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          {label ?? "shell"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="flex-1 overflow-x-auto bg-muted px-4 py-3.5">
        <code className="font-mono text-sm leading-relaxed text-foreground">
          {code}
        </code>
      </pre>
    </Card>
  )
}
