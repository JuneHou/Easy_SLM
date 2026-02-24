import { create } from "zustand";
import type { IntentSpec } from "@/types/intent.types";
import { defaultIntentSpec } from "@/types/intent.types";

interface IntentState {
  spec: IntentSpec;
  isDirty: boolean;
  setGoalText: (text: string) => void;
  setGoalFraming: (framing: string) => void;
  setAudience: (audience: IntentSpec["audience"]) => void;
  setOutputFormat: (format: IntentSpec["outputFormat"]) => void;
  setConstraints: (constraints: string[]) => void;
  setSuccessCriteria: (criteria: string[]) => void;
  commit: () => IntentSpec;
  load: (spec: IntentSpec) => void;
}

export const useIntentStore = create<IntentState>((set, get) => ({
  spec: { ...defaultIntentSpec },
  isDirty: false,
  setGoalText: (text) =>
    set((s) => ({
      spec: { ...s.spec, goalText: text },
      isDirty: true,
    })),
  setGoalFraming: (framing) =>
    set((s) => ({
      spec: { ...s.spec, goalFraming: framing },
      isDirty: true,
    })),
  setAudience: (audience) =>
    set((s) => ({
      spec: { ...s.spec, audience },
      isDirty: true,
    })),
  setOutputFormat: (outputFormat) =>
    set((s) => ({
      spec: { ...s.spec, outputFormat },
      isDirty: true,
    })),
  setConstraints: (constraints) =>
    set((s) => ({
      spec: { ...s.spec, constraints },
      isDirty: true,
    })),
  setSuccessCriteria: (successCriteria) =>
    set((s) => ({
      spec: { ...s.spec, successCriteria },
      isDirty: true,
    })),
  commit: () => {
    const next = {
      ...get().spec,
      version: get().spec.version + 1,
    };
    set({ spec: next, isDirty: false });
    return next;
  },
  load: (spec) => set({ spec: { ...spec }, isDirty: false }),
}));
