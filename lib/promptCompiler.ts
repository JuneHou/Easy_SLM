import type { IntentSpec } from "@/types/intent.types";
import type { PromptPlan } from "@/types/prompt.types";

export function compilePrompt(intent: IntentSpec, plan: PromptPlan): string {
  const header = [
    `You are a helpful assistant running on a small local model.`,
    `Goal: ${intent.goalFraming ?? intent.goalText}`,
    `Audience: ${intent.audience}`,
    `Output format: ${intent.outputFormat}`,
    intent.constraints.length
      ? `Constraints: ${intent.constraints.join("; ")}`
      : "",
    intent.successCriteria.length
      ? `Success criteria: ${intent.successCriteria.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const steps =
    plan.steps.length
      ? `\n\nInstructions:\n- ${plan.steps.join("\n- ")}`
      : "";

  const schema = plan.schemaHint
    ? `\n\nOutput schema:\n${plan.schemaHint}`
    : "";

  return `${header}${steps}${schema}`;
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
  const steps = plan.steps.length ? plan.steps : ["Follow the goal above."];
  const stricter = {
    ...plan,
    steps: [...steps, "Be strict and literal; do not add extra information."],
    variantId: "A" as const,
  };
  const shorter = {
    ...plan,
    steps: steps.slice(0, Math.max(1, Math.ceil(steps.length / 2))),
    variantId: "B" as const,
  };
  const explicit = {
    ...plan,
    steps: steps.map((s, i) => `Step ${i + 1}: ${s}`),
    variantId: "C" as const,
  };
  return {
    A: { ...stricter, compiledPrompt: compile(intent, stricter) },
    B: { ...shorter, compiledPrompt: compile(intent, shorter) },
    C: { ...explicit, compiledPrompt: compile(intent, explicit) },
  };
}
