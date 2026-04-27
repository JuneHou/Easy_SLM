"use client";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import {
  PenLine,
  FileSearch,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskId = "writing" | "summarizing" | "planning";
export type TaskMode = "slm" | "llm";

interface TaskSection {
  intro: string;
  items: string[];
}

interface TaskDef {
  id: TaskId;
  number: string;
  title: string;
  icon: React.ElementType;
  shortDescription: string;
  canDo: TaskSection;
  tellAssistant: TaskSection;
  examples: string[];
  /**
   * Pre-filled example goal shown in the SLM Goal Wizard when the participant
   * clicks "Begin with SLM". Demonstrates what a well-formed goal looks like
   * for this task type. Participants can edit or replace it.
   */
  exampleGoal: string;
  complete: string;
}

export const TASKS: TaskDef[] = [
  {
    id: "writing",
    number: "Task 1",
    title: "Write Something Useful",
    icon: PenLine,
    shortDescription:
      "Use the assistant to help you create a short piece of writing for a practical purpose.",
    canDo: {
      intro: "You might use it to write:",
      items: [
        "a message",
        "an email",
        "a social media post",
        "a short description",
        "a short story or creative paragraph",
      ],
    },
    tellAssistant: {
      intro: "You can include details such as:",
      items: [
        "who the writing is for",
        "what you want to say",
        "the tone you want",
        "anything that must be included",
        "the length or style you prefer",
      ],
    },
    examples: [
      "Help me write a polite email asking for an extension.",
      "Write a short social media post about starting a new hobby.",
      "Help me write a short story about a missed train and an unexpected friendship.",
      "Rewrite this message to sound more professional.",
    ],
    exampleGoal:
      "Write a short, polite email to my professor asking for a 2-day extension on an upcoming homework assignment. Keep it professional and brief.",
    complete:
      "Submit when you have a version that you would realistically use, send, or keep.",
  },
  {
    id: "summarizing",
    number: "Task 2",
    title: "Summarize Information",
    icon: FileSearch,
    shortDescription:
      "Use the assistant to help you understand a longer piece of content more quickly.",
    canDo: {
      intro: "You might use it to summarize:",
      items: [
        "an article",
        "notes",
        "a long message",
        "instructions",
        "a document or passage provided in the interface",
      ],
    },
    tellAssistant: {
      intro: "You can ask for:",
      items: [
        "a short summary",
        "the main points",
        "key takeaways",
        "action items",
        "a simpler explanation",
        "a summary organized by topic",
      ],
    },
    examples: [
      "Summarize this article in 3–5 bullet points.",
      "Give me the key takeaways from this passage.",
      "Explain this in simpler language.",
      "Summarize this and highlight anything important I should remember.",
    ],
    exampleGoal:
      "Summarize a piece of text I provide and pull out the key points so I can understand it quickly without reading the whole thing. Give the result as bullet points.",
    complete:
      "Submit when the summary is clear enough that you could use it instead of reading the full text again.",
  },
  {
    id: "planning",
    number: "Task 3",
    title: "Make a Plan",
    icon: CalendarDays,
    shortDescription:
      "Use the assistant to help make a practical plan or schedule for an everyday situation.",
    canDo: {
      intro: "You might use it to:",
      items: [
        "organize your day",
        "plan errands",
        "make a study schedule",
        "prepare for a deadline",
        "break a big task into smaller steps",
      ],
    },
    tellAssistant: {
      intro: "You can include:",
      items: [
        "your goal",
        "your deadline",
        "how much time you have",
        "your priorities",
        "any constraints",
        "anything you want to avoid or prefer",
      ],
    },
    examples: [
      "Help me make a study plan for an exam next week.",
      "I need to finish 3 tasks by tonight. Can you help me schedule them?",
      "Plan a morning routine for someone who has to leave home by 8:00 AM.",
      "Help me organize errands across one afternoon.",
    ],
    exampleGoal:
      "Help me make a study schedule for a midterm exam in 5 days. I have about 2 hours free each day and need to cover 4 chapters. Give me a day-by-day plan.",
    complete:
      "Submit when the plan feels realistic, specific, and easy to follow.",
  },
];

interface StudyHomePageProps {
  onStartTask: (task: TaskId, mode: TaskMode) => void;
  completedTasks: Set<string>;
}

export function StudyHomePage({ onStartTask, completedTasks }: StudyHomePageProps) {
  const allDone = TASKS.every(
    (t) => completedTasks.has(`${t.id}-slm`) && completedTasks.has(`${t.id}-llm`)
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">
            Complete Everyday Tasks with an AI Assistant
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Use the assistant to help with three common daily tasks: writing,
            summarizing, and planning.
          </p>
          {allDone && (
            <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 border border-green-500/30 px-4 py-1.5 text-sm font-medium text-green-600 mt-2">
              <CheckCircle2 className="h-4 w-4" />
              All tasks completed — thank you!
            </div>
          )}
        </header>

        {/* ── Welcome ─────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Welcome</h2>
          <div className="rounded-xl border border-border bg-surface/50 p-6 space-y-3 text-sm text-foreground leading-relaxed">
            <p>
              In this activity, you will use an AI assistant to complete a small
              set of everyday tasks.
            </p>
            <p>These tasks reflect common real-life uses of AI, such as:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
              <li>writing something you need,</li>
              <li>understanding a longer piece of information,</li>
              <li>organizing a plan or schedule.</li>
            </ul>
            <p>
              For each task, you can describe what you need in your own words,
              review the response, and ask for revisions or follow-up help until
              the result feels useful to you.
            </p>
            <p className="font-medium">
              There are no trick questions and no single correct way to interact.
              Please complete each task as you normally would.
            </p>
          </div>
        </section>

        {/* ── Before You Begin ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Before You Begin</h2>
          <div className="rounded-xl border border-border bg-surface/50 p-6 space-y-3">
            <p className="text-sm text-foreground">
              Please keep the following in mind while completing the tasks:
            </p>
            <ul className="space-y-2">
              {[
                "Use only the assistant provided in this interface.",
                "You may ask follow-up questions or request revisions.",
                "You may give more details if the first answer is not what you want.",
                "Complete each task until the result feels usable to you.",
                "When you are satisfied, click Submit Task to move on.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
              Estimated time: 10–15 minutes
            </p>
          </div>
        </section>

        {/* ── Task cards ──────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Your Tasks</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You will complete the following three tasks:
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {TASKS.map((task) => {
              const Icon = task.icon;
              const slmDone = completedTasks.has(`${task.id}-slm`);
              const llmDone = completedTasks.has(`${task.id}-llm`);
              const bothDone = slmDone && llmDone;
              return (
                <Card
                  key={task.id}
                  className={cn("flex flex-col", bothDone && "opacity-70")}
                >
                  {/* Card header */}
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {task.number}
                      </span>
                      {bothDone && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="text-base font-semibold text-foreground">
                        {task.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {task.shortDescription}
                    </p>
                  </CardHeader>

                  {/* Card body */}
                  <CardContent className="flex-1 space-y-5 text-sm">
                    {/* What You Can Do */}
                    <div className="space-y-1.5">
                      <p className="font-medium text-foreground">What You Can Do</p>
                      <p className="text-muted-foreground">{task.canDo.intro}</p>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                        {task.canDo.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {/* What to Tell the Assistant */}
                    <div className="space-y-1.5">
                      <p className="font-medium text-foreground">
                        What to Tell the Assistant
                      </p>
                      <p className="text-muted-foreground">
                        {task.tellAssistant.intro}
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                        {task.tellAssistant.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Starter examples */}
                    <div className="space-y-1.5">
                      <p className="font-medium text-foreground">Starter Examples</p>
                      <p className="text-muted-foreground">
                        You can start with something like:
                      </p>
                      <ul className="space-y-1.5">
                        {task.examples.map((ex, i) => (
                          <li
                            key={i}
                            className="rounded bg-surface border border-border px-3 py-1.5 text-xs text-foreground italic"
                          >
                            "{ex}"
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Completion criterion */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-foreground">
                      <span className="font-medium">When This Task Is Complete: </span>
                      {task.complete}
                    </div>
                  </CardContent>

                  {/* Action buttons — SLM and LLM */}
                  <div className="p-6 pt-2 space-y-2">
                    {!bothDone && (
                      <p className="text-xs text-muted-foreground text-center mb-3">
                        Choose how you want to begin:
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {/* SLM */}
                      {slmDone ? (
                        <div className="flex items-center justify-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1.5 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> SLM Done
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full flex items-center gap-1.5"
                          onClick={() => onStartTask(task.id, "slm")}
                        >
                          <Cpu className="h-3.5 w-3.5 shrink-0" />
                          Begin with SLM
                        </Button>
                      )}
                      {/* LLM */}
                      {llmDone ? (
                        <div className="flex items-center justify-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1.5 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> LLM Done
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full flex items-center gap-1.5"
                          onClick={() => onStartTask(task.id, "llm")}
                        >
                          <Cloud className="h-3.5 w-3.5 shrink-0" />
                          Begin with LLM
                        </Button>
                      )}
                    </div>
                    {!bothDone && (
                      <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        SLM guides you step-by-step · LLM goes straight to chat
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground pb-4">
          SLM Prompting Tool — Study Interface
        </footer>
      </div>
    </div>
  );
}
