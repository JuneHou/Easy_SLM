export type Provider = "local" | "openai" | "anthropic" | "google";
export type DeviceTier = "cpu" | "gpu" | "high_mem";

export interface ModelParams {
  temperature: number;
  topP: number;
  maxTokens: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface ModelProfile {
  provider: Provider;
  modelName: string;
  deviceTier: DeviceTier;
  params: ModelParams;
}

export interface ModelCatalogEntry {
  id: string;
  provider: Provider;
  modelName: string;
  deviceTier: DeviceTier;
  tags: ("Fast" | "Better Instructions" | "Low Memory")[];
  whyRecommended: string;
  defaultParams: ModelParams;
}
