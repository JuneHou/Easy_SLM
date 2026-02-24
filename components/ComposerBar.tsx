"use client";

import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useIntentStore } from "@/stores/intentStore";
import { useModelStore } from "@/stores/modelStore";
import { usePromptPlanStore } from "@/stores/promptPlanStore";
import { streamChat } from "@/lib/sseClient";
import { Button } from "./ui/button";
import { MessageSquare } from "lucide-react";

export function ComposerBar() {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const { spec } = useIntentStore();
  const { plan } = usePromptPlanStore();
  const { profile } = useModelStore();
  const { addMessage, appendStreaming, commitStreaming, clearStreaming } = useChatStore();

  const systemContent = plan.compiledPrompt || `Goal: ${spec.goalText || "No goal"}. Output format: ${spec.outputFormat}.`;

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addMessage({ role: "user", content: text });
    setStreaming(true);
    appendStreaming(""); // ensure we have a slot; real content comes from SSE

    const messages = [
      { role: "system", content: systemContent },
      { role: "user", content: text },
    ];

    streamChat(
      "/api/chat",
      { messages: messages as { role: string; content: string }[], model: profile.modelName },
      {
        onChunk: (chunk) => appendStreaming(chunk),
        onDone: () => {
          commitStreaming({
            intentVersion: spec.version,
            modelSnapshot: profile,
            warnings: spec.successCriteria.length ? ["Check output against your success criteria."] : undefined,
          });
          setStreaming(false);
        },
        onError: (err) => {
          clearStreaming();
          addMessage({
            role: "assistant",
            content: `Error: ${err.message}. (Demo: ensure /api/chat is available or use mock.)`,
            meta: { intentVersion: spec.version, modelSnapshot: profile, warnings: ["Request failed."] },
          });
          setStreaming(false);
        },
      }
    );
  };

  return (
    <div className="border-t border-border bg-surface p-4">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          className="min-h-[80px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
          rows={2}
          disabled={streaming}
        />
        <Button onClick={handleSend} disabled={streaming || !input.trim()}>
          <MessageSquare className="h-4 w-4 mr-1" />
          Send
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Composer uses your current intent and prompt plan as context. Generate variants from the Prompt plan panel.
      </p>
    </div>
  );
}
