"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-1 pl-3">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{url.replace(/^https?:\/\//, "")}</span>
      <Button size="sm" variant="secondary" onClick={copy} icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}>
        {copied ? "Copié" : "Copier"}
      </Button>
    </div>
  );
}
