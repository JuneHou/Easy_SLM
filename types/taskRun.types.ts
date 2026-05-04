import type { ChatMessage } from "./chat.types";
import type { Provider } from "./model.types";

export type StudyTaskId = "writing" | "summarizing" | "planning";
export type StudyTaskMode = "slm" | "llm";

export interface ResultRating {
  usefulness: number;
  correctness: number;
  clarity: number;
  effortRequired: number;
  trust: number;
}

export interface TaskRun {
  runId: string;
  participantId: string;
  taskId: StudyTaskId;
  condition: StudyTaskMode;
  startedAt: string;
  submittedAt?: string;
  userGoal?: string;
  originalUserPrompt: string;
  finalCompiledPrompt?: string;
  modelProvider: Provider;
  modelName: string;
  messages: ChatMessage[];
  finalUserSubmission: string;
  finalModelOutput: string;
  scaffoldUsed: {
    goalWizardOpened: boolean;
    promptPlanEdited: boolean;
    templateUsed: boolean;
    variantUsed: boolean;
    modelRecommendationUsed: boolean;
  };
  metadata: {
    latencyMs?: number;
    generationCompleted: boolean;
  };
}

export interface TaskComparison {
  comparisonId: string;
  participantId: string;
  taskId: StudyTaskId;
  slmRunId: string;
  llmRunId: string;
  slmOutput: string;
  llmOutput: string;
  /** Which condition is shown on the left as "Result A" */
  resultACondition: StudyTaskMode;
  displayOrder: "slm-left" | "llm-left";
  createdAt: string;
  participantPreference?: "a" | "b" | "tie";
  participantRatings?: { a: ResultRating; b: ResultRating };
  rationale?: string;
  submittedAt?: string;
}
