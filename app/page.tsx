"use client";

import { useState, useMemo } from "react";
import { SidebarNav, type SidebarSection } from "@/components/SidebarNav";
import { GoalWizardModal } from "@/components/GoalWizardModal";
import { TemplateGallery } from "@/components/TemplateGallery";
import { PromptPlanEditor } from "@/components/PromptPlanEditor";
import { IntentSpecRibbon } from "@/components/IntentSpecRibbon";
import { ChatPanel } from "@/components/ChatPanel";
import { ComposerBar } from "@/components/ComposerBar";
import { RightInspector } from "@/components/RightInspector";
import { CompareDrawer } from "@/components/CompareDrawer";
import { ComparisonPage } from "@/components/ComparisonPage";
import { StudyHomePage, TASKS, type TaskId, type TaskMode } from "@/components/StudyHomePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useIntentStore } from "@/stores/intentStore";
import { usePromptPlanStore } from "@/stores/promptPlanStore";
import { useTaskRunStore } from "@/stores/taskRunStore";
import type { SubmitComparisonPayload } from "@/stores/taskRunStore";
import { downloadStudyData } from "@/lib/exportStudyData";
import { defaultIntentSpec } from "@/types/intent.types";
import type { Audience, OutputFormat } from "@/types/intent.types";
import type { StudyTaskId, StudyTaskMode } from "@/types/taskRun.types";
import { ArrowLeft, CheckSquare, Cpu, Cloud } from "lucide-react";

const TASK_INTENT_DEFAULTS: Record<
  TaskId,
  { audience: Audience; outputFormat: OutputFormat }
> = {
  writing:     { audience: "public", outputFormat: "paragraph" },
  summarizing: { audience: "self",   outputFormat: "checklist" },
  planning:    { audience: "self",   outputFormat: "checklist" },
};

function SessionHistoryPanel() {
  const { messages, clearMessages } = useChatStore();
  const { profile } = useModelStore();
  const { chatProvider } = useSettingsStore();
  const handleClear = () => {
    clearMessages();
    if (chatProvider === "effgen") {
      fetch("/api/effgen/clear-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: profile.modelName }),
      }).catch(() => {});
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Chat history is saved in this browser. Refresh the page to keep your conversation.
      </p>
      <p className="text-xs text-muted-foreground">
        {messages.length} message{messages.length !== 1 ? "s" : ""} in this conversation.
      </p>
      <Button variant="outline" size="sm" onClick={handleClear}>
        Clear chat history
      </Button>
    </div>
  );
}

export default function Home() {
  // ── Task flow state ──────────────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState<TaskId | null>(null);
  const [selectedMode, setSelectedMode] = useState<TaskMode | null>(null);
  const [comparisonTask, setComparisonTask] = useState<TaskId | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);

  // ── Chat / tool pane state ───────────────────────────────────────────────
  const [sidebarSection, setSidebarSection] = useState<SidebarSection | null>(null);
  const [goalWizardOpen, setGoalWizardOpen] = useState(false);

  // ── Stores ───────────────────────────────────────────────────────────────
  const { chatProvider, setChatProvider } = useSettingsStore();
  const { profile, selectModel } = useModelStore();
  const { messages, clearMessages } = useChatStore();
  const { spec, load: loadIntent, commit: commitIntent } = useIntentStore();
  const {
    plan,
    setSteps,
    setPlan,
    setDecompositionDetails,
    clearVariants,
    recompile,
  } = usePromptPlanStore();
  const {
    runs,
    comparisons,
    participantId,
    startRun,
    finalizeRun,
    createComparison,
    submitComparison,
    getComparisonForTask,
    resetTask,
    resetStudy,
  } = useTaskRunStore();

  // Derive completed tasks from the persisted store (survives refresh)
  const completedTasks = useMemo(
    () => new Set(runs.filter((r) => r.submittedAt).map((r) => `${r.taskId}-${r.condition}`)),
    [runs]
  );

  // Tasks where the comparison has been submitted
  const comparedTasks = useMemo(
    () => new Set(comparisons.filter((c) => c.submittedAt).map((c) => c.taskId as TaskId)),
    [comparisons]
  );

  const isSlm = chatProvider === "effgen";
  const showLeftColumn =
    isSlm || sidebarSection === "examples" || sidebarSection === "history";

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetSession = () => {
    clearMessages();
    if (chatProvider === "effgen") {
      fetch("/api/effgen/clear-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: profile.modelName }),
      }).catch(() => {});
    }
    setSteps([]);
    setPlan({ compiledPrompt: "", schemaHint: undefined, templateId: undefined });
    setDecompositionDetails(null);
    clearVariants();
  };

  const handleStartTask = (task: TaskId, mode: TaskMode) => {
    resetSession();

    const taskDef = TASKS.find((t) => t.id === task)!;
    const defaults = TASK_INTENT_DEFAULTS[task];

    if (mode === "slm") {
      setChatProvider("effgen");
      selectModel("hf-qwen-3b");
      loadIntent({
        ...defaultIntentSpec,
        goalText: taskDef.exampleGoal,
        audience: defaults.audience,
        outputFormat: defaults.outputFormat,
        version: 0,
      });
    } else {
      if (chatProvider === "effgen") setChatProvider("openai");
      loadIntent({
        ...defaultIntentSpec,
        audience: defaults.audience,
        outputFormat: defaults.outputFormat,
        version: 0,
      });
    }

    const next = commitIntent();
    recompile(next);

    const runId = startRun(task as StudyTaskId, mode as StudyTaskMode);
    setActiveRunId(runId);
    setTaskStartTime(Date.now());

    setSelectedTask(task);
    setSelectedMode(mode);
    setSidebarSection(null);

    if (mode === "slm") {
      setGoalWizardOpen(true);
    }
  };

  const handleSubmitTask = () => {
    if (!selectedTask || !selectedMode || !activeRunId) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const firstUser = messages.find((m) => m.role === "user");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");

    finalizeRun(activeRunId, {
      messages,
      finalModelOutput: lastAssistant?.content ?? "",
      finalUserSubmission: lastUser?.content ?? "",
      originalUserPrompt: firstUser?.content ?? "",
      compiledPrompt: plan.compiledPrompt || undefined,
      userGoal: spec.goalText || undefined,
      modelProvider: chatProvider === "effgen" ? "local" : chatProvider,
      modelName: profile.modelName,
      latencyMs: taskStartTime ? Date.now() - taskStartTime : undefined,
      generationCompleted: !!lastAssistant,
    });

    setActiveRunId(null);
    setTaskStartTime(null);
    setSelectedTask(null);
    setSelectedMode(null);
    setSidebarSection(null);
  };

  const handleExport = () => {
    downloadStudyData(participantId, runs, comparisons);
  };

  const handleReset = () => {
    downloadStudyData(participantId, runs, comparisons);
    resetStudy();
    clearMessages();
  };

  const handleStartComparison = (taskId: TaskId) => {
    const comparisonId = createComparison(taskId as StudyTaskId);
    if (comparisonId) setComparisonTask(taskId);
  };

  const handleSubmitComparison = (
    comparisonId: string,
    payload: SubmitComparisonPayload
  ) => {
    submitComparison(comparisonId, payload);
    setComparisonTask(null);
  };

  // ── Comparison view ───────────────────────────────────────────────────────
  if (comparisonTask) {
    const comparison = getComparisonForTask(comparisonTask as StudyTaskId);
    if (comparison) {
      return (
        <ComparisonPage
          taskId={comparisonTask}
          comparison={comparison}
          onSubmit={handleSubmitComparison}
          onBack={() => setComparisonTask(null)}
        />
      );
    }
  }

  // ── Home page ────────────────────────────────────────────────────────────
  if (!selectedTask || !selectedMode) {
    return (
      <StudyHomePage
        onStartTask={handleStartTask}
        completedTasks={completedTasks}
        onCompare={handleStartComparison}
        comparedTasks={comparedTasks}
        onExport={handleExport}
        onReset={handleReset}
        onResetTask={(taskId) => resetTask(taskId as StudyTaskId)}
      />
    );
  }

  // ── Task metadata ────────────────────────────────────────────────────────
  const taskDef = TASKS.find((t) => t.id === selectedTask)!;

  // ── Chat interface (task active) ─────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav
        activeSection={sidebarSection}
        onSectionChange={(section) => setSidebarSection(section)}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* ── Task bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => { setSelectedTask(null); setSelectedMode(null); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Tasks
            </button>

            <span className="text-border shrink-0">|</span>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary shrink-0">
                {taskDef.number}
              </span>
              <span className="text-sm font-medium text-foreground truncate">
                {taskDef.title}
              </span>
            </div>

            {selectedMode === "slm" ? (
              <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                <Cpu className="h-3 w-3" /> SLM
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
                <Cloud className="h-3 w-3" /> LLM
              </span>
            )}
          </div>

          <Button size="sm" onClick={handleSubmitTask} className="shrink-0 ml-4">
            <CheckSquare className="h-4 w-4 mr-1.5" />
            Submit Task
          </Button>
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col min-w-0">
            <div className="flex flex-1 overflow-hidden">
              {showLeftColumn && (
                <div className="w-96 shrink-0 border-r border-border overflow-y-auto flex flex-col">
                  {isSlm && (sidebarSection === null || sidebarSection === "goal") && (
                    <IntentSpecRibbon />
                  )}
                  <div className="p-4 space-y-6 flex-1">
                    {sidebarSection === "templates" && (
                      <TemplateGallery onUse={() => setSidebarSection(null)} />
                    )}
                    {sidebarSection === "examples" && (
                      isSlm ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Demo use cases</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm space-y-2">
                            <p>1) Explain a lab procedure as a checklist for a rural clinic assistant</p>
                            <p>2) Summarize this paragraph for a non-expert audience without jargon</p>
                            <p>3) Extract key fields into JSON from a short note</p>
                            <p>4) Rewrite a message politely with constraints (short / formal / no extra claims)</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Examples (LLM)</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm text-muted-foreground">
                            TODO: Design LLM-specific examples.
                          </CardContent>
                        </Card>
                      )
                    )}
                    {isSlm && (sidebarSection === null || sidebarSection === "goal") && (
                      <PromptPlanEditor onOpenGoalWizard={() => setGoalWizardOpen(true)} />
                    )}
                    {sidebarSection === "history" && <SessionHistoryPanel />}
                    {sidebarSection === "settings" && (
                      <p className="text-sm text-muted-foreground">
                        Settings (theme, API endpoint, etc.).
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col min-w-0">
                <ChatPanel taskTitle={taskDef.title} />
                <ComposerBar />
              </div>
            </div>
          </main>
          <RightInspector />
        </div>
      </div>

      <GoalWizardModal
        open={goalWizardOpen}
        onClose={() => setGoalWizardOpen(false)}
      />
      <CompareDrawer />
    </div>
  );
}
