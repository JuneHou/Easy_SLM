"use client";

import { usePromptPlanStore } from "@/stores/promptPlanStore";
import { useIntentStore } from "@/stores/intentStore";
import { compilePrompt } from "@/lib/promptCompiler";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "checklist",
    title: "Checklist / Steps",
    description: "Break the task into ordered steps with a clear checklist output.",
    steps: ["Identify the main task", "List required steps in order", "Add any safety or quality checks"],
    schemaHint: "Use a bullet list with checkboxes: [ ] Step description",
  },
  {
    id: "summarize",
    title: "Summarize for audience",
    description: "Summarize content for a non-expert audience without jargon.",
    steps: ["Identify key points", "Rewrite in plain language", "Keep it concise"],
    schemaHint: "One short paragraph.",
  },
  {
    id: "extract-json",
    title: "Extract to JSON",
    description: "Extract key fields from text into a structured JSON format.",
    steps: ["Identify the fields to extract", "Define the JSON shape", "Output valid JSON only"],
    schemaHint: "Valid JSON object with the requested keys.",
  },
  {
    id: "rewrite",
    title: "Rewrite with constraints",
    description: "Rewrite a message with tone and length constraints.",
    steps: ["Preserve the core message", "Apply tone (e.g. polite, formal)", "Apply length (short/detailed)", "Avoid extra claims"],
    schemaHint: "Single message, same format as input unless specified.",
  },
];

interface TemplateGalleryProps {
  onUse?: () => void;
  className?: string;
}

export function TemplateGallery({ onUse, className }: TemplateGalleryProps) {
  const { spec } = useIntentStore();
  const { setPlan, recompile } = usePromptPlanStore();

  const handleUse = (t: (typeof TEMPLATES)[0]) => {
    const plan = {
      templateId: t.id,
      steps: t.steps,
      schemaHint: t.schemaHint,
      compiledPrompt: "",
    };
    const compiled = compilePrompt(spec, { ...plan, steps: t.steps, compiledPrompt: "" });
    setPlan({ ...plan, compiledPrompt: compiled });
    recompile(spec);
    onUse?.();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-semibold text-foreground">Task-adaptive templates</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.description}</p>
              <Button size="sm" onClick={() => handleUse(t)}>
                Use template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
