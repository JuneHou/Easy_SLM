import type { ModelProfile } from "./model.types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  meta?: {
    intentVersion: number;
    modelSnapshot: ModelProfile;
    warnings?: string[];
  };
}

export interface RunRecord {
  runId: string;
  intent: import("./intent.types").IntentSpec;
  plan: import("./prompt.types").PromptPlan;
  model: ModelProfile;
  messages: ChatMessage[];
  metrics?: { latencyMs?: number; tokensApprox?: number };
}
