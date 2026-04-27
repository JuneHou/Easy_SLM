"use client";

import { usePromptPlanStore } from "@/stores/promptPlanStore";
import { useIntentStore } from "@/stores/intentStore";
import { useState } from "react";
import { Button } from "./ui/button";
import { Accordion } from "./ui/accordion";
import type { DecompositionDetails } from "@/stores/promptPlanStore";

interface PromptPlanEditorProps {
  onOpenGoalWizard?: () => void;
}

export function PromptPlanEditor({ onOpenGoalWizard }: PromptPlanEditorProps) {
  const { spec } = useIntentStore();
  const {
    plan,
    variants,
    setPlan,
    setSteps,
    recompile,
    generateVariantsForCompare,
    decompositionDetails,
    setDecompositionDetails,
  } = usePromptPlanStore();
  const [decomposeLoading, setDecomposeLoading] = useState(false);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);

  const handleDecomposeWithEffGen = async () => {
    const currentPromptText = plan.compiledPrompt.trim();
    if (!currentPromptText) {
      setDecomposeError("Set a goal in the Goal Wizard first.");
      return;
    }
    setDecomposeError(null);
    setDecomposeLoading(true);
    try {
      const res = await fetch("/api/effgen/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: spec,
          current_prompt_text: currentPromptText,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        wrapped_prompts: string[];
        subtasks: DecompositionDetails["subtasks"];
        routing_meta: DecompositionDetails["routing_meta"];
      };
      setSteps(data.wrapped_prompts ?? []);
      setDecompositionDetails({
        subtasks: data.subtasks ?? [],
        routing_meta: data.routing_meta ?? {},
      });
      recompile(spec);
    } catch (e) {
      setDecomposeError(e instanceof Error ? e.message : String(e));
    } finally {
      setDecomposeLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {onOpenGoalWizard && (
        <Button size="sm" onClick={onOpenGoalWizard}>
          Open Goal Wizard
        </Button>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Prompt plan</h3>
        <div className="flex items-center gap-2">
          {!plan.compiledPrompt && spec.goalText === "" && (
            <span className="text-xs text-muted-foreground">Set a goal first</span>
          )}
          <Button variant="outline" size="sm" onClick={() => generateVariantsForCompare(spec)}>
            Generate variants (A/B/C)
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">System prompt</label>
        <textarea
          value={plan.compiledPrompt}
          onChange={(e) => setPlan({ compiledPrompt: e.target.value })}
          placeholder="Open the Goal Wizard to generate a system prompt…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono min-h-[120px]"
          rows={6}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleDecomposeWithEffGen}
            disabled={decomposeLoading}
          >
            {decomposeLoading ? "Decomposing…" : "Decompose with effGen"}
          </Button>
        </div>
        {decomposeError && (
          <p className="text-xs text-destructive">{decomposeError}</p>
        )}
      </div>

      {decompositionDetails && (
        <Accordion title="Decomposition details" defaultOpen={false}>
          <div className="space-y-3 text-sm">
            {decompositionDetails.routing_meta?.strategy && (
              <p className="text-muted-foreground">
                Strategy: {decompositionDetails.routing_meta.strategy}
                {decompositionDetails.routing_meta.num_subtasks != null &&
                  ` · ${decompositionDetails.routing_meta.num_subtasks} subtasks`}
              </p>
            )}
            <ul className="space-y-2">
              {decompositionDetails.subtasks.map((st, i) => (
                <li key={st.id ?? i} className="rounded border border-border bg-surface/50 px-3 py-2">
                  <span className="font-medium">{st.id ?? i + 1}.</span> {st.description}
                  {st.expected_output && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expected: {st.expected_output}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Accordion>
      )}
    </div>
  );
}
