"use client";

import { useModelStore } from "@/stores/modelStore";
import { Slider } from "./ui/slider";
import { cn } from "@/lib/utils";

// Jargon-free: Predictable ↔ Creative, Short ↔ Detailed, Stick to format, Safer answers
export function SimpleControls() {
  const { profile, setParams } = useModelStore();
  const { temperature, maxTokens } = profile.params;

  // Map Predictable (0) ↔ Creative (1) to temperature ~0.2 .. 0.9
  const predictableRaw = temperature <= 0.2 ? 0 : temperature >= 0.9 ? 100 : ((temperature - 0.2) / 0.7) * 100;
  const setPredictable = (v: number) => {
    const t = 0.2 + (v / 100) * 0.7;
    setParams({ temperature: Math.round(t * 100) / 100 });
  };

  // Short (0) ↔ Detailed (1) to maxTokens ~256 .. 2048
  const detailedRaw = maxTokens <= 256 ? 0 : maxTokens >= 2048 ? 100 : ((maxTokens - 256) / (2048 - 256)) * 100;
  const setDetailed = (v: number) => {
    const tokens = Math.round(256 + (v / 100) * (2048 - 256));
    setParams({ maxTokens: tokens });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Simple controls</h3>
      <Slider
        label="Predictable ↔ Creative"
        value={Math.round(predictableRaw)}
        onChange={setPredictable}
        min={0}
        max={100}
      />
      <Slider
        label="Short ↔ Detailed"
        value={Math.round(detailedRaw)}
        onChange={setDetailed}
        min={0}
        max={100}
      />
      <div className="flex items-center justify-between text-sm">
        <span>Stick to format</span>
        <input
          type="checkbox"
          defaultChecked
          className="rounded border-border accent-primary"
          title="Encourage output to follow the requested format"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>Safer answers</span>
        <input
          type="checkbox"
          defaultChecked
          className="rounded border-border accent-primary"
          title="Reduce risky or uncertain content"
        />
      </div>
    </div>
  );
}
