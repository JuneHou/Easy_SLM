import type { ModelCatalogEntry, ModelParams } from "@/types/model.types";

const defaultParams: ModelParams = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 1024,
};

// LLM catalog entries (OpenAI / Anthropic) for comparative study. deviceTier is nominal.
const openaiCatalog: ModelCatalogEntry[] = [
  { id: "openai-gpt4o", provider: "openai", modelName: "gpt-4o", deviceTier: "gpu", tags: ["Better Instructions"], whyRecommended: "Strong general-purpose model.", defaultParams: { ...defaultParams, maxTokens: 4096 } },
  { id: "openai-gpt4o-mini", provider: "openai", modelName: "gpt-4o-mini", deviceTier: "gpu", tags: ["Fast"], whyRecommended: "Faster, lower cost.", defaultParams },
  { id: "openai-gpt4.1", provider: "openai", modelName: "gpt-4.1", deviceTier: "gpu", tags: ["Better Instructions"], whyRecommended: "Latest GPT-4.1.", defaultParams: { ...defaultParams, maxTokens: 4096 } },
];
const anthropicCatalog: ModelCatalogEntry[] = [
  { id: "anthropic-claude-sonnet", provider: "anthropic", modelName: "claude-sonnet-4-20250514", deviceTier: "gpu", tags: ["Better Instructions"], whyRecommended: "Claude Sonnet 4.", defaultParams: { ...defaultParams, maxTokens: 4096 } },
  { id: "anthropic-claude-haiku", provider: "anthropic", modelName: "claude-3-5-haiku-latest", deviceTier: "gpu", tags: ["Fast"], whyRecommended: "Faster Claude option.", defaultParams },
];

// effGen uses Hugging Face model IDs (e.g. Qwen/Qwen2.5-3B-Instruct). Ollama-style names (llama3.2:3b) are not valid for HF.
export const modelCatalog: ModelCatalogEntry[] = [
  {
    id: "hf-qwen-1.5b",
    provider: "local",
    modelName: "Qwen/Qwen2.5-1.5B-Instruct",
    deviceTier: "cpu",
    tags: ["Fast", "Low Memory"],
    whyRecommended: "Works with effGen. Small, runs on CPU.",
    defaultParams: { ...defaultParams, maxTokens: 512 },
  },
  {
    id: "hf-qwen-3b",
    provider: "local",
    modelName: "Qwen/Qwen2.5-3B-Instruct",
    deviceTier: "gpu",
    tags: ["Better Instructions", "Fast"],
    whyRecommended: "Default for effGen. Good balance of speed and quality.",
    defaultParams,
  },
  {
    id: "ollama-llama3.2",
    provider: "local",
    modelName: "llama3.2:3b",
    deviceTier: "cpu",
    tags: ["Fast", "Low Memory"],
    whyRecommended: "Ollama only (not effGen). Runs well on CPU.",
    defaultParams: { ...defaultParams, maxTokens: 512 },
  },
  {
    id: "ollama-phi3",
    provider: "local",
    modelName: "phi3:mini",
    deviceTier: "cpu",
    tags: ["Better Instructions", "Low Memory"],
    whyRecommended: "Good at following structured instructions with limited RAM.",
    defaultParams,
  },
  {
    id: "ollama-mistral",
    provider: "local",
    modelName: "mistral:7b",
    deviceTier: "gpu",
    tags: ["Better Instructions"],
    whyRecommended: "Strong instruction-following when you have a GPU.",
    defaultParams: { ...defaultParams, maxTokens: 2048 },
  },
  {
    id: "ollama-qwen",
    provider: "local",
    modelName: "qwen2.5:7b",
    deviceTier: "gpu",
    tags: ["Better Instructions", "Fast"],
    whyRecommended: "Balances speed and quality for detailed outputs.",
    defaultParams: { ...defaultParams, maxTokens: 2048 },
  },
  {
    id: "ollama-llama3.1",
    provider: "local",
    modelName: "llama3.1:8b",
    deviceTier: "high_mem",
    tags: ["Better Instructions"],
    whyRecommended: "Best quality for complex prompts if you have enough RAM.",
    defaultParams: { ...defaultParams, maxTokens: 2048 },
  },
];

export function getShortlist(
  deviceTier: "cpu" | "gpu" | "high_mem",
  _intentHint?: string
): ModelCatalogEntry[] {
  return modelCatalog.filter((m) => m.deviceTier === deviceTier).slice(0, 5);
}

/** Shortlist for LLM mode by chat provider (openai | anthropic). */
export function getShortlistForChatProvider(
  provider: "openai" | "anthropic"
): ModelCatalogEntry[] {
  return provider === "openai" ? openaiCatalog : anthropicCatalog;
}

export function getModelById(id: string): ModelCatalogEntry | undefined {
  return (
    modelCatalog.find((m) => m.id === id) ??
    openaiCatalog.find((m) => m.id === id) ??
    anthropicCatalog.find((m) => m.id === id)
  );
}
