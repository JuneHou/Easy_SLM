import { create } from "zustand";
import type { PromptPlan, VariantId } from "@/types/prompt.types";
import type { IntentSpec } from "@/types/intent.types";
import { compilePrompt, generateVariants } from "@/lib/promptCompiler";

export interface DecompositionSubtask {
  id: string;
  description: string;
  expected_output?: string;
  depends_on?: string[];
  estimated_complexity?: number;
  required_specialization?: string;
}

export interface DecompositionDetails {
  subtasks: DecompositionSubtask[];
  routing_meta: { strategy?: string; reasoning?: string; num_subtasks?: number };
}

interface PromptPlanState {
  plan: PromptPlan;
  variants: { A: PromptPlan; B: PromptPlan; C: PromptPlan } | null;
  decompositionDetails: DecompositionDetails | null;
  setPlan: (plan: Partial<PromptPlan>) => void;
  setSteps: (steps: string[]) => void;
  setSchemaHint: (hint: string) => void;
  setDecompositionDetails: (details: DecompositionDetails | null) => void;
  recompile: (intent: IntentSpec) => void;
  generateVariantsForCompare: (intent: IntentSpec) => void;
  pickBest: (variantId: VariantId) => void;
  clearVariants: () => void;
}

export const usePromptPlanStore = create<PromptPlanState>((set, get) => ({
  plan: { steps: [], compiledPrompt: "" },
  variants: null,
  decompositionDetails: null,
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
  setDecompositionDetails: (decompositionDetails) =>
    set({ decompositionDetails }),
  recompile: (intent) =>
    set((s) => ({
      plan: {
        ...s.plan,
        compiledPrompt: compilePrompt(intent, s.plan),
      },
    })),
  generateVariantsForCompare: (intent) => {
    const { plan } = get();
    // Always generate from empty steps so variant modifiers don't accumulate
    // across repeated generate-and-pick cycles.
    const basePlan = { ...plan, steps: [] };
    const vars = generateVariants(intent, basePlan, compilePrompt);
    set({ variants: vars });
  },
  pickBest: (variantId) => {
    const { variants } = get();
    if (!variants) return;
    const chosen = variants[variantId];
    // Store only the compiled prompt; reset steps so the next variant
    // generation always starts from a clean base.
    set((s) => ({
      plan: { ...s.plan, compiledPrompt: chosen.compiledPrompt, steps: [] },
      variants: null,
    }));
  },
  clearVariants: () => set({ variants: null }),
}));
