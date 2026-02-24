"use client";

import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export function ChatPanel() {
  const { messages, streamingContent } = useChatStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground text-sm">
            <p>No messages yet.</p>
            <p>Set your goal and prompt plan, then send a message from the composer below.</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-lg border px-4 py-3",
              m.role === "user"
                ? "ml-8 border-primary/30 bg-primary/5"
                : "mr-8 border-border bg-surface"
            )}
          >
            <div className="text-xs text-muted-foreground mb-1">
              {m.role === "user" ? "You" : "Assistant"}
              {m.meta?.modelSnapshot && (
                <span className="ml-2">· {m.meta.modelSnapshot.modelName}</span>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            {m.meta?.warnings && m.meta.warnings.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded bg-warning/10 border border-warning/30 px-2 py-1.5 text-xs text-warning">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">What to check:</span>{" "}
                  {m.meta.warnings.join(" ")}
                </div>
              </div>
            )}
          </div>
        ))}
        {streamingContent != null && (
          <div className="mr-8 rounded-lg border border-border bg-surface px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">Assistant (streaming)</div>
            <div className="text-sm whitespace-pre-wrap">
              {streamingContent}
              <span className="animate-pulse">▌</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
