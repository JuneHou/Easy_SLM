import type { IntentSpec, OutputFormat } from "@/types/intent.types";
import type { PromptPlan } from "@/types/prompt.types";

function getTaskLabel(outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case "checklist": return "organizing and planning";
    case "table": return "organizing information";
    case "json": return "structured data extraction";
    case "paragraph":
    default: return "writing";
  }
}

function getOutputFormatLabel(outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case "checklist": return "bullet-point checklist";
    case "table": return "table";
    case "json": return "JSON";
    case "paragraph":
    default: return "paragraph";
  }
}

export function compilePrompt(intent: IntentSpec, plan: PromptPlan): string {
  const parts: string[] = [
    `You are an AI assistant, who will help with ${getTaskLabel(intent.outputFormat)}.`,
  ];

  if (intent.goalText) {
    parts.push("");
    parts.push(intent.goalText);
  }

  parts.push("");
  parts.push(`Output: ${getOutputFormatLabel(intent.outputFormat)}`);

  if (intent.constraints.length) {
    parts.push(`Constraints: ${intent.constraints.join("; ")}`);
  }
  if (intent.successCriteria.length) {
    parts.push(`Success criteria: ${intent.successCriteria.join("; ")}`);
  }

  if (plan.steps.length) {
    parts.push("");
    parts.push(`Instructions:\n- ${plan.steps.join("\n- ")}`);
  }

  if (plan.schemaHint) {
    parts.push("");
    parts.push(`Output schema:\n${plan.schemaHint}`);
  }

  return parts.join("\n");
}

export function decomposeIntoSteps(instruction: string): string[] {
  const trimmed = instruction.trim();
  if (!trimmed) return [];
  const lines = trimmed
    .split(/\n+/)
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return sentences.length > 1 ? sentences : [trimmed];
}

export function generateVariants(
  intent: IntentSpec,
  plan: PromptPlan,
  compile: (i: IntentSpec, p: PromptPlan) => string
): { A: PromptPlan; B: PromptPlan; C: PromptPlan } {
  // goalText is already in the compiled header; don't repeat it as a step.
  const baseSteps = plan.steps.length ? plan.steps : [];

  // A — More strict: appends a literalness constraint.
  const stricter = {
    ...plan,
    steps: [...baseSteps, "Be strict and literal; do not add extra information."],
    variantId: "A" as const,
  };
  // B — Shorter: same steps but instructs a concise reply (does not cut steps,
  //   which loses context on short plans).
  const shorter = {
    ...plan,
    steps: [...baseSteps, "Keep your reply as concise as possible."],
    variantId: "B" as const,
  };
  // C — More explicit: numbers every step for clarity.
  const explicitSteps = baseSteps.length
    ? baseSteps.map((s, i) => `Step ${i + 1}: ${s}`)
    : ["Follow the goal exactly as stated."];
  const explicit = {
    ...plan,
    steps: explicitSteps,
    variantId: "C" as const,
  };
  return {
    A: { ...stricter, compiledPrompt: compile(intent, stricter) },
    B: { ...shorter, compiledPrompt: compile(intent, shorter) },
    C: { ...explicit, compiledPrompt: compile(intent, explicit) },
  };
}
