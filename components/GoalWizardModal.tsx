"use client";

import { useIntentStore } from "@/stores/intentStore";
import { usePromptPlanStore } from "@/stores/promptPlanStore";
import type { IntentSpec, OutputFormat } from "@/types/intent.types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "./ToastProvider";
import { X } from "lucide-react";
import { useState } from "react";

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "checklist", label: "Checklist" },
  { value: "table", label: "Table" },
  { value: "json", label: "JSON" },
];

interface GoalWizardModalProps {
  open: boolean;
  onClose: () => void;
}

export function GoalWizardModal({ open, onClose }: GoalWizardModalProps) {
  const { spec, setGoalText, setOutputFormat, setConstraints, setSuccessCriteria, commit } = useIntentStore();
  const { recompile } = usePromptPlanStore();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [constraintInput, setConstraintInput] = useState("");
  const [criteriaInput, setCriteriaInput] = useState("");

  if (!open) return null;

  const handleCommit = () => {
    const next = commit();
    // Recompile so the compiled system prompt immediately reflects the new intent.
    recompile(next);
    toast?.("Intent updated", "success");
    onClose();
    setStep(1);
  };

  const addConstraint = () => {
    const t = constraintInput.trim();
    if (t) {
      setConstraints([...spec.constraints, t]);
      setConstraintInput("");
    }
  };

  const addCriterion = () => {
    const t = criteriaInput.trim();
    if (t) {
      setSuccessCriteria([...spec.successCriteria, t]);
      setCriteriaInput("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Goal Wizard</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-6">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">One-sentence goal</label>
                <textarea
                  value={spec.goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  placeholder="e.g. Explain a lab procedure as a checklist for a rural clinic assistant"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
                  rows={3}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)}>Next</Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Output format</label>
                <div className="flex flex-wrap gap-2">
                  {FORMAT_OPTIONS.map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={spec.outputFormat === value ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setOutputFormat(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Constraints (must / avoid)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={constraintInput}
                    onChange={(e) => setConstraintInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addConstraint()}
                    placeholder="Add constraint..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addConstraint}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {spec.constraints.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => setConstraints(spec.constraints.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Success criteria</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={criteriaInput}
                    onChange={(e) => setCriteriaInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCriterion()}
                    placeholder="e.g. Concise, step-by-step, no jargon"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addCriterion}>Add</Button>
                </div>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {spec.successCriteria.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {c}
                      <button
                        type="button"
                        onClick={() => setSuccessCriteria(spec.successCriteria.filter((_, j) => j !== i))}
                        className="text-danger text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={handleCommit}>Save intent</Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
