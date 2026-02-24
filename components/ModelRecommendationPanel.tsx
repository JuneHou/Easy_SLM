"use client";

import { useModelStore } from "@/stores/modelStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function ModelRecommendationPanel() {
  const { deviceTier, shortlist, profile, setDeviceTier, selectModel } = useModelStore();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Model recommendation</h3>
      <div>
        <label className="text-xs text-muted-foreground">Device (demo)</label>
        <div className="flex gap-1 mt-1">
          {(["cpu", "gpu", "high_mem"] as const).map((tier) => (
            <Button
              key={tier}
              variant={deviceTier === tier ? "primary" : "outline"}
              size="sm"
              onClick={() => setDeviceTier(tier)}
            >
              {tier === "cpu" ? "CPU" : tier === "gpu" ? "GPU" : "High RAM"}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {shortlist.map((m) => (
          <Card
            key={m.id}
            className={cn(
              "cursor-pointer transition-colors",
              profile.modelName === m.modelName ? "ring-2 ring-primary"
                : "hover:bg-surface/80"
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
        Selected: <strong>{profile.modelName}</strong>. Apply updates the run settings.
      </p>
    </div>
  );
}
