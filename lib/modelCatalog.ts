import type { ModelCatalogEntry, ModelParams } from "@/types/model.types";

const defaultParams: ModelParams = {
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 1024,
};

export const modelCatalog: ModelCatalogEntry[] = [
  {
    id: "ollama-llama3.2",
    provider: "local",
    modelName: "llama3.2:3b",
    deviceTier: "cpu",
    tags: ["Fast", "Low Memory"],
    whyRecommended: "Runs well on CPU and responds quickly for short tasks.",
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

export function getModelById(id: string): ModelCatalogEntry | undefined {
  return modelCatalog.find((m) => m.id === id);
}
