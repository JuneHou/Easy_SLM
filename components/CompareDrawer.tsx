"use client";

import { usePromptPlanStore } from "@/stores/promptPlanStore";
import type { VariantId } from "@/types/prompt.types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { PromptCodeViewer } from "./PromptCodeViewer";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompareDrawer() {
  const { variants, pickBest, clearVariants } = usePromptPlanStore();

  if (!variants) return null;

  const labels: Record<VariantId, string> = {
    A: "More strict",
    B: "Shorter",
    C: "More explicit",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Compare variants — Pick best</h2>
          <Button variant="ghost" size="sm" onClick={clearVariants}>
            Close
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 overflow-y-auto flex-1">
          {(["A", "B", "C"] as VariantId[]).map((id) => (
            <Card key={id} className="flex flex-col overflow-hidden">
              <CardHeader className="py-2">
                <CardTitle className="text-sm">{labels[id]}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-2">
                <PromptCodeViewer value={variants[id].compiledPrompt} className="min-h-[120px]" />
              </CardContent>
              <div className="p-2 border-t border-border">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => pickBest(id)}
                >
                  <Check className="h-4 w-4 mr-1" /> Pick this one
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
