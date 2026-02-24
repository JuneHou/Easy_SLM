"use client";

import { cn } from "@/lib/utils";

interface PromptCodeViewerProps {
  value: string;
  className?: string;
}

export function PromptCodeViewer({ value, className }: PromptCodeViewerProps) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded border border-border bg-background p-3 text-xs font-mono text-foreground whitespace-pre-wrap",
        className
      )}
    >
      {value || "(No compiled prompt yet)"}
    </pre>
  );
}
