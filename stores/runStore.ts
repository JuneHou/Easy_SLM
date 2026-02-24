import { create } from "zustand";
import type { RunRecord } from "@/types/chat.types";
import { generateId } from "@/lib/utils";

interface RunState {
  runs: RunRecord[];
  addRun: (run: Omit<RunRecord, "runId">) => RunRecord;
  getRun: (runId: string) => RunRecord | undefined;
}

export const useRunStore = create<RunState>((set, get) => ({
  runs: [],
  addRun: (run) => {
    const record: RunRecord = { ...run, runId: generateId() };
    set((s) => ({ runs: [record, ...s.runs].slice(0, 50) }));
    return record;
  },
  getRun: (runId) => get().runs.find((r) => r.runId === runId),
}));
