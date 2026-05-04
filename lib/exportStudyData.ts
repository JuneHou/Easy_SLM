import type { TaskRun, TaskComparison } from "@/types/taskRun.types";

export interface StudyExport {
  exportedAt: string;
  participantId: string;
  runs: TaskRun[];
  comparisons: TaskComparison[];
}

export function downloadStudyData(
  participantId: string,
  runs: TaskRun[],
  comparisons: TaskComparison[]
): void {
  const payload: StudyExport = {
    exportedAt: new Date().toISOString(),
    participantId,
    runs,
    comparisons,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `study-${participantId}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
