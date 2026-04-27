# Work Log: effGen + LLM Comparative Interface Updates

Current status of integration and UI behavior in `Easy_SLM`, including both SLM (effGen) and closed-source LLM paths.

---

## 1. effGen Backend Changes (completed)

### 1.1 Chat (`POST /run`)
- Added optional `system_prompt` in request body.
- Easy_SLM passes compiled scaffolding prompt (intent + prompt plan) when in SLM mode.

### 1.2 Decomposition (`POST /decompose`)
- Added endpoint to return `{ subtasks, wrapped_prompts, routing_meta }`.
- Uses rule-based decomposition engine (no external LLM required).

### 1.3 Model Reuse Cache
- Added in-memory `agent_cache` keyed by model.
- Added `force_reload` field (Easy_SLM sends this from reuse toggle).
- Cache guardrails:
  - cache only successful model loads (`agent.model` exists),
  - drop invalid cached agent and recreate when needed.

### 1.4 Async Runtime / uvloop Fix
- Added uvloop-safe fallback for async tool execution (thread + `asyncio.run`), avoiding `nest_asyncio` failure under uvicorn/uvloop.

### 1.5 Quantization Reliability
- Improved 8-bit loading with CPU offload (`llm_int8_enable_fp32_cpu_offload=True`) and proper `device_map` usage.

### 1.6 Memory Reset (`POST /clear_memory`)
- Added endpoint to clear conversation memory per model (or all models).

---

## 2. Easy_SLM API (Next.js) Current Behavior

### 2.1 Unified Chat Route
- Route: `POST /api/chat`
- Request now supports:
  - `provider?: "effgen" | "openai" | "anthropic"`
  - `messages`, `intent`, `promptPlan`, `modelConfig`, `reuseLoadedModel`

### 2.2 Provider Routing
- `provider === "effgen"`:
  - proxy to effGen `/run` with `task`, `system_prompt`, `model`, `temperature`, `force_reload`
- `provider === "openai"`:
  - server-side call to OpenAI Chat Completions (streaming)
- `provider === "anthropic"`:
  - server-side call to Anthropic Messages API (streaming)

### 2.3 SSE Contract (unchanged to frontend)
- All providers emit normalized SSE:
  - `data: {"text":"..."}`
  - `data: [DONE]`

### 2.4 effGen Support Routes
- `POST /api/effgen/decompose` → effGen `/decompose`
- `POST /api/effgen/clear-memory` → effGen `/clear_memory`

---

## 3. UI / UX Current State

### 3.1 Sidebar Mode Tabs
- Left sidebar now has **SLM** / **LLM** tabs.
- SLM tab maps to `chatProvider = "effgen"`.
- LLM tab maps to LLM provider mode (`openai` default unless user switched to `anthropic` in right panel).

### 3.2 Right Panel
- **SLM mode:** shows model recommendation panel + effGen card (`Reuse loaded model`) + controls.
- **LLM mode:** shows new LLM model selector:
  - provider sub-choice: OpenAI / Anthropic
  - provider-specific model list
  - same control area location as SLM mode.

### 3.3 Left Middle Column Behavior (latest)
- **SLM mode:** full behavior remains (Goal Wizard / Prompt Plan / Template Gallery / Examples / History / Settings).
- **LLM mode (requested behavior):**
  - left column is hidden for Goal Wizard and Template Gallery,
  - left column still appears for:
    - `Session History`
    - `Examples` (currently placeholder: `TODO: Design LLM-specific examples`).

### 3.4 Composer + Clear
- Composer sends `provider` with chat request.
- Clear chat:
  - always clears local persisted messages,
  - calls effGen clear-memory **only when provider is effgen**.

### 3.5 Chat Persistence
- Chat messages persist in browser (`easy-slm-chat`) via Zustand persist middleware.

---

## 4. Stores / Types Updated

### 4.1 `settingsStore`
- Existing:
  - `reuseLoadedModel`
- Added:
  - `chatProvider: "effgen" | "openai" | "anthropic"`
  - `setChatProvider(...)`
- Persist key remains `easy-slm-settings`.

### 4.2 `modelCatalog`
- Kept effGen-compatible HF defaults.
- Added LLM catalog entries for:
  - OpenAI
  - Anthropic
- Added helper `getShortlistForChatProvider(...)`.

### 4.3 `sseClient`
- `ChatRequestBody` now includes optional `provider`.

---

## 5. Config / Environment

- `.env.example` now includes:
  - `EFFGEN_BASE_URL`
  - commented placeholders for:
    - `OPENAI_API_KEY`
    - `ANTHROPIC_API_KEY`
- Node 18+ remains required (`.nvmrc`, `engines`, `.npmrc` strict setting already configured).

---

## 6. Current Comparative-Study Readout

| Area | Current state |
|------|---------------|
| **Provider switch** | Sidebar tabs: SLM vs LLM |
| **SLM path** | effGen + prompt scaffolding + decomposition + model reuse |
| **LLM path** | OpenAI/Anthropic via `/api/chat` with normalized SSE |
| **Layout parity** | Chat and right panel locations unchanged across modes |
| **LLM no-scaffolding policy** | Goal Wizard/Template hidden; LLM Examples + Session History still available |
| **Memory clear** | effGen memory cleared only in SLM mode; LLM mode clears local chat only |

---

## 7. SLM Scaffolding Connection Fixes (completed)

Addressed the Goal Wizard Modal and Variant Generation not having any observable effect on the chat or prompt plan.

### 7.1 Root Cause: `recompile` never called after intent save (`GoalWizardModal`)
- `commit()` updated `intentStore.spec` but `promptPlanStore.recompile()` was never called.
- `ComposerBar` uses `plan.compiledPrompt` as the system prompt. Because it was never recompiled after the wizard, every chat message used a stale (empty) system prompt regardless of what the wizard captured.
- **Fix:** `GoalWizardModal.handleCommit` now calls `recompile(next)` immediately after `commit()`, so the compiled system prompt reflects the new intent before the first message is sent.

### 7.2 Plan seeding from Goal Wizard
- With no steps in the plan, variant generation produced three trivially different outputs (all based on the placeholder `"Follow the goal above."`).
- **Fix:** If `plan.steps` is empty when the wizard is saved, one step is auto-seeded from `goalText`. This gives the prompt plan a concrete starting point and makes variant generation meaningful without requiring the user to manually add a step first.

### 7.3 `generateVariants` improved for no-steps case (`lib/promptCompiler.ts`)
- When steps are empty, `generateVariants` now falls back to `intent.goalText` (rather than a generic placeholder) as the base step.
- Variant B changed from "cut steps in half" (useless on 1–2 step plans) to "same steps + brevity instruction" (`"Keep your reply as concise as possible."`), making the three variants genuinely distinct:
  - A: original step(s) + strict/literal constraint
  - B: original step(s) + brevity constraint
  - C: original step(s) numbered explicitly (`Step N: …`)

### 7.4 `Accordion` controlled mode (`components/ui/accordion.tsx`)
- Added optional `open?: boolean` and `onOpenChange?: (open: boolean) => void` props for external control, while keeping the existing uncontrolled (local state) behavior when those props are omitted.

### 7.5 Auto-open "Compiled prompt preview" accordion (`PromptPlanEditor`)
- After Goal Wizard save: the accordion auto-opens the first time `compiledPrompt` goes from empty to non-empty, showing the user that their intent is now active.
- After picking a variant: detects the `variants → null` transition (triggered by `pickBest`) and opens the accordion to display the selected variant's compiled prompt.

### 7.6 `IntentSpecRibbon` rendered in SLM left column (`app/page.tsx`)
- `IntentSpecRibbon` existed but was never rendered.
- Added as a full-width sticky header at the top of the left column in SLM/goal mode. Shows current goal, audience, output format, active constraints/criteria count, and intent version number — confirming the intent is live and connected to the chat session.
- Left column restructured from `p-4 space-y-6` single div to: ribbon (full-width, no padding) + inner `p-4 space-y-6 flex-1` content div.

### 7.7 End-to-end test scenario
Added to `test-prompts.txt` (section 3): a complete Goal Wizard → Prompt Plan → Variant → Chat example run using a clinic hand-washing checklist goal, with expected observable outcomes at each step.

---

## 8. Study Home Page & Task Flow (completed)

Added a study instruction home page and task-based navigation so participants start from a structured overview rather than landing directly in the chat interface.

### 8.1 Study task definition — three everyday tasks
Three tasks selected to cover Creation, Information Search, and Advice domains:
- **Task 1 — Writing / Creation:** "Write Something Useful" (email, social post, short story, etc.)
- **Task 2 — Information Search / Summarization:** "Summarize Information" (article, notes, passage, etc.)
- **Task 3 — Advice / Planning:** "Make a Plan" (schedule, study plan, errands, etc.)

### 8.2 `components/StudyHomePage.tsx` (new)
Full study instruction page rendered when no task is active. Sections:
- **Page header** — title + subtitle
- **Welcome** — activity overview, three use-case bullets, naturalness note
- **Before You Begin** — 5 study rules including "click Submit Task to move on"
- **Your Tasks** — 3-column card grid (stacks to single column on small screens). Each card shows: task number/title/icon, short description, "What You Can Do" list, "What to Tell the Assistant" list, quoted starter examples, completion criterion, and a "Start [Task] Task" button that is replaced with "✓ Completed" after submission.
- **Reminder** — revision guidance, no perfect prompt required
- **All-done banner** — appears when all 3 tasks are marked complete

Exports: `StudyHomePage`, `TaskId`, `TASKS` (array of task definitions, re-used by `page.tsx` for the task bar label).

### 8.3 `app/page.tsx` — task selection flow
- Added `selectedTask: TaskId | null` state (null = home page, value = active task).
- Added `completedTasks: Set<TaskId>` state to persist completion across navigation.
- When `selectedTask === null`: renders `StudyHomePage`. The app is no longer an always-on chat interface; it starts at the study overview.
- **`handleStartTask(task)`**: resets chat + effGen memory + prompt plan + variants; pre-loads a clean intent with task-appropriate defaults (`audience`, `outputFormat`) using `intentStore.load`; commits and recompiles; in SLM mode, auto-opens the Goal Wizard so the participant can describe their specific goal within the task context.
- **`handleSubmitTask()`**: adds the task to `completedTasks`, navigates back to home.
- Default intent presets per task:
  | Task | Audience | Output format |
  |------|----------|---------------|
  | Writing | public | paragraph |
  | Summarizing | self | checklist |
  | Planning | self | checklist |

### 8.4 Task bar in chat interface
A narrow bar rendered above the sidebar+chat area when a task is active:
- **Left:** "← Back to Tasks" link (returns to home without marking complete) · task number badge · task title
- **Right:** "Submit Task ✓" button (marks task complete and returns home)

### 8.5 `components/ChatPanel.tsx` — task-aware empty state
`ChatPanel` now accepts an optional `taskTitle` prop. When a task is active and no messages exist, the empty state shows the task title and "Describe what you need in your own words and press Send." instead of the generic "No messages yet" text.

---

## 9. Dual-Mode Begin Buttons (SLM vs LLM per task card)

### 9.1 Design rationale
Each task card now exposes two entry points side by side: **Begin with SLM** (Cpu icon, primary style) and **Begin with LLM** (Cloud icon, outline style). This makes the study condition selection explicit at the point of task entry rather than requiring a global mode toggle, and the visual pairing makes the comparison intent immediately clear to participants.

### 9.2 `exampleGoal` field added to each task (`StudyHomePage.tsx`)
Each task in `TASKS` now carries an `exampleGoal` string — a realistic, editable goal pre-loaded into the SLM Goal Wizard when the participant enters SLM mode. Examples:
- Writing: *"Write a short, polite email to my professor asking for a 2-day extension on an upcoming homework assignment. Keep it professional and brief."*
- Summarizing: *"Summarize a piece of text I provide and pull out the key points so I can understand it quickly without reading the whole thing. Give the result as bullet points."*
- Planning: *"Help me make a study schedule for a midterm exam in 5 days. I have about 2 hours free each day and need to cover 4 chapters. Give me a day-by-day plan."*

The example goals: (a) demonstrate correct goal format, (b) include key contextual details (audience, format, constraints), (c) are editable so participants replace them with their own content.

### 9.3 `TaskMode` type exported from `StudyHomePage.tsx`
`export type TaskMode = "slm" | "llm"` — used by page.tsx to drive provider switching and wizard behavior.

### 9.4 `onStartTask` signature change
`(task: TaskId) → (task: TaskId, mode: TaskMode)` — both files updated.

### 9.5 `handleStartTask` updated in `page.tsx`
**SLM path:**
1. `setChatProvider("effgen")`
2. `loadIntent({ ...defaults, goalText: taskDef.exampleGoal })` — Goal Wizard opens with example pre-filled
3. `commitIntent()` + `recompile()`
4. `setGoalWizardOpen(true)` — wizard opens automatically

**LLM path:**
1. `setChatProvider("openai")` only if currently on effGen; otherwise preserves the experimenter's pre-configured LLM provider (e.g. Anthropic)
2. `loadIntent({ ...defaults, goalText: "" })` — no goal text, goes straight to chat
3. `commitIntent()` + `recompile()`
4. No wizard opened

### 9.6 `selectedMode` state in `page.tsx`
Added `selectedMode: TaskMode | null` to track the active mode. Both `setSelectedTask` and `setSelectedMode` are reset on submit or back-navigation.

### 9.7 Mode badge in task bar
The task bar now shows a pill badge next to the task title:
- SLM: `bg-primary/10 border-primary/40 text-primary` with Cpu icon
- LLM: `bg-muted/50 border-border text-muted-foreground` with Cloud icon

### 9.8 Completed state simplified
When `done`, the two buttons are replaced with a single "✓ Completed" line (no buttons). A small helper text "SLM guides you step-by-step · LLM goes straight to chat" sits below the buttons when the task is not yet done.
