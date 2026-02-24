"use client";

import { useIntentStore } from "@/stores/intentStore";
import { cn } from "@/lib/utils";

export function IntentSpecRibbon() {
  const { spec } = useIntentStore();
  const goal = spec.goalFraming || spec.goalText || "No goal set";

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface/95 px-4 py-2 text-sm backdrop-blur">
      <span className="font-medium text-muted-foreground">Intent:</span>
      <span className="text-foreground" title={goal}>
        {goal.length > 60 ? `${goal.slice(0, 60)}…` : goal}
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">Audience: {spec.audience}</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">Output: {spec.outputFormat}</span>
      {spec.constraints.length > 0 && (
        <>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            Constraints: {spec.constraints.slice(0, 2).join(", ")}
            {spec.constraints.length > 2 && ` +${spec.constraints.length - 2}`}
          </span>
        </>
      )}
      {spec.successCriteria.length > 0 && (
        <>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            Criteria: {spec.successCriteria.length} item(s)
          </span>
        </>
      )}
      <span className="ml-auto text-xs text-muted-foreground">v{spec.version}</span>
    </div>
  );
}
