"use client";

import { usePromptPlanStore } from "@/stores/promptPlanStore";
import { useIntentStore } from "@/stores/intentStore";
import { decomposeIntoSteps } from "@/lib/promptCompiler";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Accordion } from "./ui/accordion";
import { PromptCodeViewer } from "./PromptCodeViewer";
import { cn } from "@/lib/utils";
import type { DecompositionDetails } from "@/stores/promptPlanStore";

interface PromptPlanEditorProps {
  onOpenGoalWizard?: () => void;
}

export function PromptPlanEditor({ onOpenGoalWizard }: PromptPlanEditorProps) {
  const { spec } = useIntentStore();
  const {
    plan,
    setSteps,
    recompile,
    generateVariantsForCompare,
    decompositionDetails,
    setDecompositionDetails,
  } = usePromptPlanStore();
  const [freeform, setFreeform] = useState("");
  const [decomposeLoading, setDecomposeLoading] = useState(false);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);

  const handleDecomposeWithEffGen = async () => {
    const currentPromptText =
      freeform.trim() || plan.steps.join("\n") || "";
    if (!currentPromptText) {
      setDecomposeError("Enter or paste prompt text first.");
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

  const handleBreakIntoSteps = () => {
    const text = freeform.trim() || plan.steps.join("\n");
    const steps = decomposeIntoSteps(text);
    if (steps.length) {
      setSteps(steps);
      recompile(spec);
    }
  };

  const addStep = () => {
    const newStep = freeform.trim() || "New step";
    setSteps([...plan.steps, newStep]);
    setFreeform("");
    recompile(spec);
  };

  const removeStep = (i: number) => {
    setSteps(plan.steps.filter((_, j) => j !== i));
    recompile(spec);
  };

  const moveStep = (i: number, dir: "up" | "down") => {
    const next = [...plan.steps];
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
    recompile(spec);
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateVariantsForCompare(spec)}>
            Generate variants (A/B/C)
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Instructions (one per line or break into steps)</label>
        <textarea
          value={freeform || plan.steps.join("\n")}
          onChange={(e) => setFreeform(e.target.value)}
          placeholder="Enter or edit steps..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono min-h-[80px]"
          rows={4}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleDecomposeWithEffGen}
            disabled={decomposeLoading}
          >
            {decomposeLoading ? "Decomposing…" : "Decompose with effGen"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleBreakIntoSteps}>
            Break into steps
          </Button>
          <Button size="sm" onClick={addStep}>Add step</Button>
        </div>
        {decomposeError && (
          <p className="text-xs text-destructive">{decomposeError}</p>
        )}
      </div>

      {plan.steps.length > 0 && (
        <ul className="space-y-1">
          {plan.steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-muted-foreground w-6">{i + 1}.</span>
              <span className="flex-1">{step}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveStep(i, "up")} disabled={i === 0}>↑</Button>
                <Button variant="ghost" size="sm" onClick={() => moveStep(i, "down")} disabled={i === plan.steps.length - 1}>↓</Button>
                <Button variant="ghost" size="sm" onClick={() => removeStep(i)}>×</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Accordion title="Compiled prompt preview" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <PromptCodeViewer value={plan.compiledPrompt} />
          </div>
          {plan.steps.length > 0 && (
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Broken into steps:</h4>
              <ul className="space-y-1">
                {plan.steps.map((step, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {i + 1}. {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Accordion>

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
