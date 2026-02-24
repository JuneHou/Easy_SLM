"use client";

import { ModelRecommendationPanel } from "./ModelRecommendationPanel";
import { SimpleControls } from "./SimpleControls";
import { AdvancedControlsAccordion } from "./AdvancedControlsAccordion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { BarChart3 } from "lucide-react";

export function RightInspector() {
  return (
    <aside className="w-80 shrink-0 flex flex-col gap-4 border-l border-border bg-surface/50 p-4 overflow-y-auto">
      <ModelRecommendationPanel />
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
