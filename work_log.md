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
