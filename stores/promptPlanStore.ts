import { create } from "zustand";
import type { PromptPlan, VariantId } from "@/types/prompt.types";
import type { IntentSpec } from "@/types/intent.types";
import { compilePrompt, generateVariants } from "@/lib/promptCompiler";

interface PromptPlanState {
  plan: PromptPlan;
  variants: { A: PromptPlan; B: PromptPlan; C: PromptPlan } | null;
  setPlan: (plan: Partial<PromptPlan>) => void;
  setSteps: (steps: string[]) => void;
  setSchemaHint: (hint: string) => void;
  recompile: (intent: IntentSpec) => void;
  generateVariantsForCompare: (intent: IntentSpec) => void;
  pickBest: (variantId: VariantId) => void;
  clearVariants: () => void;
}

export const usePromptPlanStore = create<PromptPlanState>((set, get) => ({
  plan: { steps: [], compiledPrompt: "" },
  variants: null,
  setPlan: (partial) =>
    set((s) => ({
      plan: { ...s.plan, ...partial },
    })),
  setSteps: (steps) =>
    set((s) => ({
      plan: { ...s.plan, steps },
    })),
  setSchemaHint: (schemaHint) =>
    set((s) => ({
      plan: { ...s.plan, schemaHint },
    })),
  recompile: (intent) =>
    set((s) => ({
      plan: {
        ...s.plan,
        compiledPrompt: compilePrompt(intent, s.plan),
      },
    })),
  generateVariantsForCompare: (intent) => {
    const { plan } = get();
    const vars = generateVariants(intent, plan, compilePrompt);
    set({ variants: vars });
  },
  pickBest: (variantId) => {
    const { variants } = get();
    if (!variants) return;
    const chosen = variants[variantId];
    set({
      plan: { ...chosen, variantId: undefined },
      variants: null,
    });
  },
  clearVariants: () => set({ variants: null }),
}));
