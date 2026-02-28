"use client";

import { ModelRecommendationPanel } from "./ModelRecommendationPanel";
import { SimpleControls } from "./SimpleControls";
import { AdvancedControlsAccordion } from "./AdvancedControlsAccordion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { BarChart3, Cpu } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

export function RightInspector() {
  const { reuseLoadedModel, setReuseLoadedModel } = useSettingsStore();

  return (
    <aside className="w-80 shrink-0 flex flex-col gap-4 border-l border-border bg-surface/50 p-4 overflow-y-auto">
      <ModelRecommendationPanel />
      <Card>
        <CardContent className="pt-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4" /> effGen
          </h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={reuseLoadedModel}
              onChange={(e) => setReuseLoadedModel(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span>Reuse loaded model</span>
          </label>
          <p className="text-xs text-muted-foreground">
            When on, the same model is kept loaded between messages (faster; history preserved). Turn off to force reload each time.
          </p>
        </CardContent>
      </Card>
      <SimpleControls />
      <AdvancedControlsAccordion />
      <Card>
        <CardContent className="pt-4">
          <Button variant="outline" size="sm" className="w-full" disabled>
            <BarChart3 className="h-4 w-4 mr-2" /> Quick benchmark (demo)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Optional: mock score table for 2–3 models.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
