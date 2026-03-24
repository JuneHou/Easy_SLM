"use client";

import { usePromptPlanStore } from "@/stores/promptPlanStore";
import { useIntentStore } from "@/stores/intentStore";
import { compilePrompt } from "@/lib/promptCompiler";
import {
  EFFGEN_CATEGORIES,
  getTemplatesByCategory,
  type EffGenTemplate,
} from "@/lib/effgenTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface TemplateGalleryProps {
  onUse?: () => void;
  className?: string;
}

export function TemplateGallery({ onUse, className }: TemplateGalleryProps) {
  const { spec } = useIntentStore();
  const { setPlan, recompile } = usePromptPlanStore();
  const byCategory = getTemplatesByCategory();

  const handleUse = (t: EffGenTemplate) => {
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
    <div className={cn("space-y-6", className)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">effGen templates</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          From{" "}
          <a
            href="https://github.com/ctrl-gaurav/effGen/tree/main/effgen/prompts/templates"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            effgen/prompts/templates
          </a>
        </p>
      </div>
      {EFFGEN_CATEGORIES.map(({ id: categoryId, label }) => {
        const templates = byCategory[categoryId];
        if (!templates.length) return null;
        return (
          <div key={categoryId} className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
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
      })}
    </div>
  );
}
