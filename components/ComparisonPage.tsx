"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TASKS, type TaskId } from "@/components/StudyHomePage";
import type { TaskComparison, ResultRating } from "@/types/taskRun.types";
import type { SubmitComparisonPayload } from "@/stores/taskRunStore";
import { useTaskRunStore } from "@/stores/taskRunStore";
import { cn } from "@/lib/utils";

const RATING_LABELS: { field: keyof ResultRating; label: string }[] = [
  { field: "usefulness",     label: "Usefulness" },
  { field: "correctness",    label: "Correctness" },
  { field: "clarity",        label: "Clarity" },
  { field: "trust",          label: "Trust" },
  { field: "effortRequired", label: "Effort required" },
];

function RatingRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-xs text-foreground w-32 shrink-0">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "w-7 h-7 rounded text-xs font-medium border transition-colors",
              value === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface border-border text-muted-foreground hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingGrid({
  label,
  ratings,
  onChange,
  disabled,
}: {
  label: string;
  ratings: Partial<ResultRating>;
  onChange: (field: keyof ResultRating, v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      {RATING_LABELS.map(({ field, label: rowLabel }) => (
        <RatingRow
          key={field}
          label={rowLabel}
          value={ratings[field]}
          onChange={(v) => onChange(field, v)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function isCompleteRating(r: Partial<ResultRating>): r is ResultRating {
  return RATING_LABELS.every(({ field }) => r[field] !== undefined);
}

interface ComparisonPageProps {
  taskId: TaskId;
  comparison: TaskComparison;
  onSubmit: (comparisonId: string, payload: SubmitComparisonPayload) => void;
  onBack: () => void;
}

export function ComparisonPage({
  taskId,
  comparison,
  onSubmit,
  onBack,
}: ComparisonPageProps) {
  const taskDef = TASKS.find((t) => t.id === taskId)!;
  const alreadySubmitted = !!comparison.submittedAt;
  const { runs } = useTaskRunStore();

  const slmRun = runs.find((r) => r.runId === comparison.slmRunId);
  const llmRun = runs.find((r) => r.runId === comparison.llmRunId);

  const messagesA =
    comparison.displayOrder === "slm-left"
      ? (slmRun?.messages ?? [])
      : (llmRun?.messages ?? []);
  const messagesB =
    comparison.displayOrder === "slm-left"
      ? (llmRun?.messages ?? [])
      : (slmRun?.messages ?? []);

  // Fallback to stored output string if messages aren't available
  const outputA =
    comparison.displayOrder === "slm-left"
      ? comparison.slmOutput
      : comparison.llmOutput;
  const outputB =
    comparison.displayOrder === "slm-left"
      ? comparison.llmOutput
      : comparison.slmOutput;

  const [preference, setPreference] = useState<"a" | "b" | "tie" | null>(
    comparison.participantPreference ?? null
  );
  const [ratingsA, setRatingsA] = useState<Partial<ResultRating>>(
    comparison.participantRatings?.a ?? {}
  );
  const [ratingsB, setRatingsB] = useState<Partial<ResultRating>>(
    comparison.participantRatings?.b ?? {}
  );
  const [rationale, setRationale] = useState(comparison.rationale ?? "");

  const canSubmit = !alreadySubmitted && preference !== null;

  const handleSubmit = () => {
    if (!canSubmit || !preference) return;
    const ratings =
      isCompleteRating(ratingsA) && isCompleteRating(ratingsB)
        ? { a: ratingsA, b: ratingsB }
        : undefined;
    onSubmit(comparison.comparisonId, {
      preference,
      ratings,
      rationale: rationale.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Tasks
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">
              Compare Results: {taskDef.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              You completed this task with both systems. Review the two results
              below and share your preference.
            </p>
          </div>
          {alreadySubmitted && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
            </span>
          )}
        </div>

        {/* Side-by-side outputs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(["A", "B"] as const).map((side) => {
            const messages = side === "A" ? messagesA : messagesB;
            const fallbackOutput = side === "A" ? outputA : outputB;
            const isSelected = preference === (side.toLowerCase() as "a" | "b");
            const visibleMessages = messages.filter((m) => m.role !== "system");
            return (
              <Card
                key={side}
                className={cn(
                  "flex flex-col transition-colors",
                  isSelected && "border-primary ring-1 ring-primary/30"
                )}
              >
                <CardHeader className="pb-2">
                  <p className="text-sm font-semibold text-foreground">
                    Result {side}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="rounded-lg bg-surface border border-border p-3 min-h-[160px] max-h-[480px] overflow-y-auto space-y-3">
                    {visibleMessages.length > 0 ? (
                      visibleMessages.map((m) => (
                        <div key={m.id} className={cn(
                          "text-sm leading-relaxed",
                          m.role === "user"
                            ? "text-muted-foreground italic border-l-2 border-border pl-2"
                            : "text-foreground whitespace-pre-wrap"
                        )}>
                          {m.role === "user" && (
                            <span className="text-xs font-medium not-italic text-muted-foreground block mb-0.5">You</span>
                          )}
                          {m.content}
                        </div>
                      ))
                    ) : fallbackOutput ? (
                      <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                        {fallbackOutput}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">
                        No output recorded.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Preference */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Which result better helped you complete the task?
          </p>
          <div className="flex flex-wrap gap-3">
            {(
              [
                { value: "a", label: "Result A" },
                { value: "b", label: "Result B" },
                { value: "tie", label: "About the same" },
              ] as const
            ).map(({ value, label }) => (
              <label
                key={value}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-4 py-2.5 cursor-pointer text-sm transition-colors select-none",
                  preference === value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-surface text-foreground hover:border-primary/50",
                  alreadySubmitted && "cursor-not-allowed opacity-70"
                )}
              >
                <input
                  type="radio"
                  name="preference"
                  value={value}
                  checked={preference === value}
                  disabled={alreadySubmitted}
                  onChange={() => setPreference(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Ratings */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">
            Please rate each result:{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (1 = low · 5 = high)
            </span>
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-4">
                <RatingGrid
                  label="Result A"
                  ratings={ratingsA}
                  onChange={(field, v) =>
                    setRatingsA((prev) => ({ ...prev, [field]: v }))
                  }
                  disabled={alreadySubmitted}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <RatingGrid
                  label="Result B"
                  ratings={ratingsB}
                  onChange={(field, v) =>
                    setRatingsB((prev) => ({ ...prev, [field]: v }))
                  }
                  disabled={alreadySubmitted}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Optional rationale */}
        <div className="space-y-2">
          <label
            htmlFor="rationale"
            className="text-sm font-medium text-foreground"
          >
            Why did you prefer this result?{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (optional)
            </span>
          </label>
          <textarea
            id="rationale"
            rows={3}
            disabled={alreadySubmitted}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="e.g. It was clearer and easier to follow."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {alreadySubmitted
              ? "Your comparison has been saved."
              : "Select a preference above to enable submission."}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="sm"
            className="min-w-[140px]"
          >
            {alreadySubmitted ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Submitted
              </>
            ) : (
              "Submit Comparison"
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
