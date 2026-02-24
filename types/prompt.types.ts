export type VariantId = "A" | "B" | "C";

export interface PromptPlan {
  templateId?: string;
  steps: string[];
  schemaHint?: string;
  compiledPrompt: string;
  variantId?: VariantId;
}

export const defaultPromptPlan: PromptPlan = {
  steps: [],
  compiledPrompt: "",
};
