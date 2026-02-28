# Work Log: effGen Integration & Interface Updates

Summary of features added with effGen and functionality/interface updates in the SLM Prompting Tool (Easy_SLM) during this integration work.

---

## 1. effGen Backend Changes

### 1.1 Phase 1 — Chat (POST /run)
- **Extended request body:** `TaskRequest` now accepts optional `system_prompt`. The app sends intent + compiled prompt plan as system context.
- **Behavior:** Each request can pass a different system prompt; when model is cached, the first request’s system prompt is kept for that cached agent.

### 1.2 Phase 2 — Decomposition (POST /decompose)
- **New endpoint:** `POST /decompose`
- **Request:** `{ "intent": {...}, "current_prompt_text": "..." }`
- **Response:** `{ "subtasks", "wrapped_prompts", "routing_meta" }`
- **Implementation:** Uses `DecompositionEngine` in rule-based mode (no LLM). Splits by “and”, numbered items, or research/synthesis keywords.

### 1.3 Model Caching (Reuse Loaded Model)
- **Agent cache:** `app.state.agent_cache` keyed by model id. When the same model is requested and `force_reload` is false, the cached agent is reused (no reload).
- **New request field:** `force_reload: Optional[bool] = False`. When true, a new agent is created and not taken from cache.
- **Cache rules:**  
  - Only cache an agent if `agent.model` is not `None` (do not cache after a failed load).  
  - When reusing, if the cached agent has no model, remove it from cache and create a new agent.

### 1.4 Async Tools + uvloop
- **Issue:** Under FastAPI/uvicorn (uvloop), `nest_asyncio.apply()` raised `ValueError: Can't patch loop of type uvloop.Loop`.
- **Change:** Catch `(ImportError, ValueError)` and fall back to running the async tool in a `ThreadPoolExecutor` with `asyncio.run()` in a separate thread. Tool timeout in fallback increased to 60s.

### 1.5 8-bit Quantization + GPU Memory
- **Issue:** 8-bit load could fail with “Some modules are dispatched on the CPU or the disk” when GPU RAM was tight.
- **Changes in `transformers_engine.py`:**  
  - For 8-bit: set `llm_int8_enable_fp32_cpu_offload=True` in `BitsAndBytesConfig`.  
  - When a quantization config is used, always pass `device_map` into `from_pretrained` so CPU offload can be used.

### 1.6 Clear Memory (POST /clear_memory)
- **New endpoint:** `POST /clear_memory`
- **Request:** `{ "model": "<model_id>" }` or `{}`
- **Behavior:** Calls `reset_memory()` on the cached agent(s) for the given model (or all cached agents if no model). Clears short-term conversation memory so the next `/run` has no prior turns.
- **Response:** `{ "cleared": true, "model": "..." }` or `{ "cleared": true, "models": [...] }`

---

## 2. Easy_SLM (Next.js) Backend & API

### 2.1 Chat Proxy (Phase 1)
- **Route:** `POST /api/chat`
- **Body:** `{ messages, intent?, promptPlan?, modelConfig?, reuseLoadedModel? }`
- **Behavior:** Builds `task` (last user message) and `system_prompt` from intent + prompt plan. Proxies to `EFFGEN_BASE_URL/run` with `task`, `model`, `system_prompt`, `temperature`, `max_iterations`, `force_reload: !reuseLoadedModel`. Returns response as SSE stream (`data: {"text": output}` then `data: [DONE]`).
- **Config:** `EFFGEN_BASE_URL` from env (default `http://localhost:8000`).

### 2.2 Decompose Proxy (Phase 2)
- **Route:** `POST /api/effgen/decompose`
- **Body:** `{ intent?, current_prompt_text }`
- **Behavior:** Proxies to effGen `POST /decompose`, returns `{ subtasks, wrapped_prompts, routing_meta }`.

### 2.3 Clear Memory Proxy
- **Route:** `POST /api/effgen/clear-memory`
- **Body:** `{ model?: string }`
- **Behavior:** Proxies to effGen `POST /clear_memory` so the cached agent’s conversation memory is cleared.

---

## 3. Easy_SLM Interface & Frontend

### 3.1 Composer (Send + effGen)
- **ComposerBar:** Sends to `/api/chat` with `messages`, `intent`, `promptPlan`, `modelConfig`, and `reuseLoadedModel` from stores.
- **SSE:** Unchanged contract; backend converts effGen JSON response into SSE chunks.

### 3.2 Prompt Plan Editor (Decompose with effGen)
- **New primary action:** “Decompose with effGen” button. Calls `/api/effgen/decompose` with current intent and prompt text (textarea or steps).
- **Behavior:** Replaces the Steps list with `wrapped_prompts`; stores `subtasks` and `routing_meta` for the accordion; recompiles prompt.
- **“Decomposition details” accordion:** Shows when decomposition has been run: strategy, number of subtasks, and each subtask’s description and expected output.
- **Fallback:** “Break into steps” remains as local, non-effGen option.

### 3.3 Model Selection (effGen-Compatible)
- **Model catalog:** Default and first options use Hugging Face model ids (e.g. `Qwen/Qwen2.5-1.5B-Instruct`, `Qwen/Qwen2.5-3B-Instruct`) so effGen Transformers backend can load them. Ollama-style names (e.g. `llama3.2:3b`) kept with note “Ollama only (not effGen)”.
- **Default profile:** `modelName: "Qwen/Qwen2.5-3B-Instruct"`, `deviceTier: "gpu"` so the app works with effGen out of the box.

### 3.4 Chat History Persistence
- **Chat store:** Zustand `persist` middleware; key `easy-slm-chat`; only `messages` persisted to localStorage.
- **Result:** Conversations survive refresh and new tabs (same origin).

### 3.5 Session History Panel
- **Content:** Short note that chat is saved in the browser; message count for current conversation; “Clear chat history” button.
- **Clear:** Clears local chat store and calls `POST /api/effgen/clear-memory` with current model so backend memory is cleared too.

### 3.6 Reuse Loaded Model (Setting)
- **Store:** `settingsStore` with `reuseLoadedModel: boolean` (default `true`), persisted as `easy-slm-settings`.
- **UI:** Right panel “effGen” card with checkbox “Reuse loaded model” and short description (reuse vs force reload).
- **Flow:** When on, `/api/chat` sends `force_reload: false` so effGen reuses the cached agent; when off, sends `force_reload: true`.

### 3.7 Clear Chat Button (by Message Input)
- **Placement:** Next to Send (trash icon below Send) in ComposerBar.
- **Action:** Clears chat store (UI + persisted history) and calls `POST /api/effgen/clear-memory` with current model. Tooltip: “Clear chat and backend memory”.
- **Disabled:** While streaming.

---

## 4. Stores & Types (Easy_SLM)

### 4.1 promptPlanStore
- **New state:** `decompositionDetails: DecompositionDetails | null` and `setDecompositionDetails`.
- **Types exported:** `DecompositionDetails`, `DecompositionSubtask` (for subtasks and routing_meta).

### 4.2 settingsStore (new)
- **State:** `reuseLoadedModel: boolean`, `setReuseLoadedModel`.
- **Persistence:** `easy-slm-settings` in localStorage.

### 4.3 sseClient
- **Body type:** `ChatRequestBody` extended with `reuseLoadedModel?: boolean`.

---

## 5. Config, Docs & Test Data

### 5.1 Environment & Node
- **.env.example:** `EFFGEN_BASE_URL=http://localhost:8000`.
- **.nvmrc:** `18`.
- **.npmrc:** `engine-strict=true` so install fails fast on Node &lt; 18.
- **package.json:** `engines: { "node": ">=18.0.0" }`; scripts use `next` (no npx) so local install is used after `npm install`.

### 5.2 README
- **Getting started:** Node 18+ requirement; effGen setup (venv/conda, `effgen serve`, `EFFGEN_BASE_URL`).
- **Interface:** Documented “Decompose with effGen”, “Decomposition details” accordion, Send → effGen `/run`, Session History (persistence + clear), effGen “Reuse loaded model” setting.
- **API:** Documented `POST /api/chat`, `POST /api/effgen/decompose`, and proxy behavior.
- **Test prompt:** Example prompts that do not require web search (OOP, recursion); reference to `test-prompts.txt`.

### 5.3 test-prompts.txt
- **Decomposition (long):** OOP summary, classes vs interfaces, three clean-code practices, inheritance vs composition (no web search).
- **Decomposition (short):** Recursion definition, example, when to use/avoid, alternative for deep nesting (no web search).
- **Chat:** e.g. 15% tip on a bill.
- **Note:** Clarified that effGen decomposition does not require long prompts; structure (“and”, numbered items, or research/synthesis wording) matters for multiple steps.

---

## 6. Summary Table

| Area | Addition / update |
|------|-------------------|
| **effGen** | `system_prompt` on `/run`; new `/decompose` and `/clear_memory`; agent cache + `force_reload`; only cache successful loads; uvloop-safe async tool execution; 8-bit CPU offload + device_map. |
| **Easy_SLM API** | `/api/chat` → effGen `/run` (SSE); `/api/effgen/decompose`; `/api/effgen/clear-memory`. |
| **Easy_SLM UI** | Decompose with effGen + Decomposition details; Reuse loaded model setting; chat persistence; Session History with clear; Clear (trash) by composer; model catalog defaults for effGen. |
| **Easy_SLM state** | Chat persist; `decompositionDetails` in prompt plan; new `settingsStore`; Composer and Session History clear both UI and backend memory. |
