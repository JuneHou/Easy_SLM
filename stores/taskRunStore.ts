import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "@/lib/utils";
import type {
  TaskRun,
  TaskComparison,
  StudyTaskId,
  StudyTaskMode,
  ResultRating,
} from "@/types/taskRun.types";
import type { ChatMessage } from "@/types/chat.types";
import type { Provider } from "@/types/model.types";

export interface FinalizePayload {
  messages: ChatMessage[];
  finalModelOutput: string;
  finalUserSubmission: string;
  originalUserPrompt: string;
  compiledPrompt?: string;
  userGoal?: string;
  modelProvider: Provider;
  modelName: string;
  latencyMs?: number;
  generationCompleted: boolean;
}

export interface SubmitComparisonPayload {
  preference: "a" | "b" | "tie";
  ratings?: { a: ResultRating; b: ResultRating };
  rationale?: string;
}

interface TaskRunState {
  participantId: string;
  runs: TaskRun[];
  comparisons: TaskComparison[];

  startRun: (taskId: StudyTaskId, condition: StudyTaskMode) => string;
  updateScaffold: (
    runId: string,
    field: keyof TaskRun["scaffoldUsed"],
    value: boolean
  ) => void;
  finalizeRun: (runId: string, payload: FinalizePayload) => void;
  createComparison: (taskId: StudyTaskId) => string | null;
  submitComparison: (
    comparisonId: string,
    payload: SubmitComparisonPayload
  ) => void;
  getRunsForTask: (taskId: StudyTaskId) => {
    slm?: TaskRun;
    llm?: TaskRun;
  };
  getComparisonForTask: (taskId: StudyTaskId) => TaskComparison | undefined;
  resetTask: (taskId: StudyTaskId) => void;
  resetStudy: () => void;
}

export const useTaskRunStore = create<TaskRunState>()(
  persist(
    (set, get) => ({
      participantId: generateId(),
      runs: [],
      comparisons: [],

      startRun: (taskId, condition) => {
        const runId = generateId();
        const run: TaskRun = {
          runId,
          participantId: get().participantId,
          taskId,
          condition,
          startedAt: new Date().toISOString(),
          originalUserPrompt: "",
          finalUserSubmission: "",
          finalModelOutput: "",
          modelProvider: "local",
          modelName: "",
          messages: [],
          scaffoldUsed: {
            goalWizardOpened: false,
            promptPlanEdited: false,
            templateUsed: false,
            variantUsed: false,
            modelRecommendationUsed: false,
          },
          metadata: { generationCompleted: false },
        };
        set((s) => ({ runs: [...s.runs, run] }));
        return runId;
      },

      updateScaffold: (runId, field, value) => {
        set((s) => ({
          runs: s.runs.map((r) =>
            r.runId === runId
              ? { ...r, scaffoldUsed: { ...r.scaffoldUsed, [field]: value } }
              : r
          ),
        }));
      },

      finalizeRun: (runId, payload) => {
        set((s) => ({
          runs: s.runs.map((r) =>
            r.runId === runId
              ? {
                  ...r,
                  submittedAt: new Date().toISOString(),
                  messages: payload.messages,
                  finalModelOutput: payload.finalModelOutput,
                  finalUserSubmission: payload.finalUserSubmission,
                  originalUserPrompt: payload.originalUserPrompt,
                  finalCompiledPrompt: payload.compiledPrompt,
                  userGoal: payload.userGoal,
                  modelProvider: payload.modelProvider,
                  modelName: payload.modelName,
                  metadata: {
                    latencyMs: payload.latencyMs,
                    generationCompleted: payload.generationCompleted,
                  },
                }
              : r
          ),
        }));
      },

      createComparison: (taskId) => {
        const existing = get().comparisons.find((c) => c.taskId === taskId);
        if (existing) return existing.comparisonId;

        const { slm, llm } = get().getRunsForTask(taskId);
        if (!slm?.submittedAt || !llm?.submittedAt) return null;

        const displayOrder: "slm-left" | "llm-left" =
          Math.random() < 0.5 ? "slm-left" : "llm-left";
        const resultACondition: StudyTaskMode =
          displayOrder === "slm-left" ? "slm" : "llm";

        const comparison: TaskComparison = {
          comparisonId: generateId(),
          participantId: get().participantId,
          taskId,
          slmRunId: slm.runId,
          llmRunId: llm.runId,
          slmOutput: slm.finalModelOutput,
          llmOutput: llm.finalModelOutput,
          resultACondition,
          displayOrder,
          createdAt: new Date().toISOString(),
        };

        set((s) => ({ comparisons: [...s.comparisons, comparison] }));
        return comparison.comparisonId;
      },

      submitComparison: (comparisonId, payload) => {
        set((s) => ({
          comparisons: s.comparisons.map((c) =>
            c.comparisonId === comparisonId
              ? {
                  ...c,
                  participantPreference: payload.preference,
                  participantRatings: payload.ratings,
                  rationale: payload.rationale,
                  submittedAt: new Date().toISOString(),
                }
              : c
          ),
        }));
      },

      getRunsForTask: (taskId) => {
        const runs = get().runs;
        return {
          slm: runs.find(
            (r) => r.taskId === taskId && r.condition === "slm" && r.submittedAt
          ),
          llm: runs.find(
            (r) => r.taskId === taskId && r.condition === "llm" && r.submittedAt
          ),
        };
      },

      getComparisonForTask: (taskId) => {
        return get().comparisons.find((c) => c.taskId === taskId);
      },

      resetTask: (taskId) => {
        set((s) => ({
          runs: s.runs.filter((r) => r.taskId !== taskId),
          comparisons: s.comparisons.filter((c) => c.taskId !== taskId),
        }));
      },
      resetStudy: () => {
        set({ runs: [], comparisons: [] });
      },
    }),
    {
      name: "easy-slm-task-runs",
      partialize: (state) => ({
        participantId: state.participantId,
        runs: state.runs,
        comparisons: state.comparisons,
      }),
    }
  )
);
