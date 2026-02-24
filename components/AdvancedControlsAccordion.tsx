"use client";

import { useModelStore } from "@/stores/modelStore";
import { Accordion } from "./ui/accordion";
import { Slider } from "./ui/slider";

export function AdvancedControlsAccordion() {
  const { profile, setParams } = useModelStore();
  const p = profile.params;

  return (
    <Accordion title="Advanced parameters" defaultOpen={false}>
      <div className="space-y-4">
        <Slider
          label="Temperature"
          value={p.temperature}
          onChange={(v) => setParams({ temperature: v })}
          min={0}
          max={1}
          step={0.05}
        />
        <Slider
          label="Top P"
          value={p.topP}
          onChange={(v) => setParams({ topP: v })}
          min={0}
          max={1}
          step={0.05}
        />
        <Slider
          label="Max tokens"
          value={p.maxTokens}
          onChange={(v) => setParams({ maxTokens: v })}
          min={128}
          max={4096}
          step={128}
        />
        {p.topK != null && (
          <Slider
            label="Top K"
            value={p.topK}
            onChange={(v) => setParams({ topK: v })}
            min={1}
            max={100}
          />
        )}
      </div>
    </Accordion>
  );
}
