"use client";

import { useEffect } from "react";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { getShortlistForChatProvider } from "@/lib/modelCatalog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";

export function LLMModelSelector() {
  const { chatProvider, setChatProvider } = useSettingsStore();
  const { profile, selectModel } = useModelStore();
  const shortlist = getShortlistForChatProvider(chatProvider);

  // When in LLM mode, ensure selected model belongs to current provider (openai/anthropic).
  useEffect(() => {
    const list = getShortlistForChatProvider(chatProvider);
    if (list.length === 0) return;
    const currentInList = list.some((m) => m.modelName === profile.modelName);
    if (!currentInList) selectModel(list[0].id);
  }, [chatProvider, profile.modelName, selectModel]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Model (LLM)</h3>
      <div>
        <label className="text-xs text-muted-foreground">Provider</label>
        <div className="flex gap-1 mt-1">
          <button
            type="button"
            onClick={() => setChatProvider("openai")}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              chatProvider === "openai"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            OpenAI
          </button>
          <button
            type="button"
            onClick={() => setChatProvider("anthropic")}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              chatProvider === "anthropic"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            Anthropic
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {shortlist.map((m) => (
          <Card
            key={m.id}
            className={cn(
              "cursor-pointer transition-colors",
              profile.modelName === m.modelName ? "ring-2 ring-primary" : "hover:bg-surface/80"
            )}
            onClick={() => selectModel(m.id)}
          >
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{m.modelName}</CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="flex flex-wrap gap-1 mb-2">
                {m.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Why: {m.whyRecommended}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Selected: <strong>{profile.modelName}</strong>
      </p>
    </div>
  );
}
