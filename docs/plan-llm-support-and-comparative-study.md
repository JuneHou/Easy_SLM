# Plan: Closed-Source LLM Support & Comparative Study

**Goal:** (1) Support closed-source LLMs (GPT, Claude) in the same user interface. (2) Enable a comparative study where **SLM** uses our prompt decomposition, model selection, and prompt scaffolding, while **LLM** uses the **exact same chat layout (colors, location)** but **without** those additional supports—so the comparison is fair and the only variable is scaffolding vs. none.

---

## 1. What Stays Identical (Both Conditions)

- **Chat area:** Same position (center column), same colors, same composer (textarea + Send + Clear). Message bubbles and styling unchanged.
- **Overall layout:** Same three-column structure (sidebar | left panel + chat | right panel). No relocation of chat or composer.
- **Session / persistence:** Chat history and clear behavior remain the same (for LLM we do not call effGen clear_memory; we can add a no-op or a separate “clear context” later if needed for API providers).

---

## 2. What Differs by Condition

| Element | SLM (effGen) condition | LLM (GPT/Claude) condition |
|--------|-------------------------|-----------------------------|
| **Backend** | `POST /api/chat` → effGen `/run` | `POST /api/chat` → OpenAI or Anthropic API |
| **Model list** | Current catalog (Qwen, Ollama, etc.) | Closed-source list (e.g. GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet) |
| **Left column** | Goal Wizard, Prompt Plan Editor, Decompose with effGen, Template Gallery | **No scaffolding:** hide or replace with a single neutral block (e.g. “No prompt scaffolding in this mode”) so **layout and width stay the same** |
| **Right panel** | Model recommendation + “Reuse loaded model” + Simple/Advanced controls | Same **position and style**; content = model selector (GPT/Claude models) + temperature (and same sliders if desired). No “Reuse loaded model” (N/A for API). No effGen card. |
| **System prompt** | Full compiled prompt (goal + intent + steps) | For comparative study: **minimal or empty** system prompt so LLM has no extra scaffolding (or optional “neutral” one-line; define in study protocol). |
| **Decompose / templates** | Available and used | **Not shown** (or shown disabled with “Not available in LLM mode”) so users do not get decomposition or template scaffolding. |

---

## 3. Provider / Mode Concept

- **Provider (or “backend”)** = who handles chat: `effgen` | `openai` | `anthropic`.
- Stored in app state (e.g. a small **provider store** or a field in **settings store**): `provider: 'effgen' | 'openai' | 'anthropic'`.
- **Study mode** can be inferred: when `provider !== 'effgen'` we treat as “LLM condition” (no scaffolding in UI, minimal system prompt). When `provider === 'effgen'` we keep current behavior (full scaffolding).

---

## 4. Backend (Next.js) Changes

1. **`POST /api/chat`**
   - Request body: add **`provider?: 'effgen' | 'openai' | 'anthropic'`** (default `effgen` for backward compatibility).
   - **If `provider === 'effgen'`:** Keep current behavior (proxy to effGen, SSE as today).
   - **If `provider === 'openai'`:**
     - Use `OPENAI_API_KEY` from env.
     - Build messages: for comparative study, system message = minimal or empty; assistant/user from `body.messages`.
     - Call OpenAI Chat Completions (or streaming). Map response to same SSE shape (`data: {"text": ...}` then `data: [DONE]`) so the frontend does not change.
   - **If `provider === 'anthropic'`:**
     - Use `ANTHROPIC_API_KEY` from env.
     - Same idea: minimal/empty system, same message format, stream if possible and convert to same SSE contract.
   - **Optional:** Extract a small `streamOpenAI(...)` / `streamAnthropic(...)` and a shared “stream to SSE” helper so the response path is one for the UI.

2. **No new routes required** if we keep a single `/api/chat` that branches on `provider`. Alternatively, `/api/chat/openai` and `/api/chat/anthropic` could be added and the frontend calls the right one; a single route with `provider` is simpler and keeps one contract.

3. **Clear memory:** When `provider !== 'effgen'`, the frontend can skip calling `/api/effgen/clear-memory` (or the route no-ops for non-effGen). No backend memory to clear for stateless APIs.

4. **Env:** Document `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in `.env.example` (values not committed). No keys in code.

---

## 5. Frontend Changes

1. **Provider / mode state**
   - Add **provider** to settings (or a dedicated store): `effgen | openai | anthropic`.
   - Persist so the user’s choice is remembered (e.g. in `settingsStore`).

2. **Provider selector in the left sidebar (SLM vs LLM tabs)**
   - In the **left sidebar**, add **SLM** and **LLM** tabs at the top (e.g. directly under the “SLM Tool” header, or as the first row of the nav). This is the main mode switch for the comparative study.
   - **SLM tab** → provider is effGen; nav items below (Goal Wizard, Template Gallery, Examples, Session History, Settings) behave as today; left column shows full scaffolding.
   - **LLM tab** → provider is OpenAI or Anthropic; left column shows the “no scaffolding” placeholder; the **right panel** still shows the model selector, where the user picks the specific LLM (e.g. OpenAI vs Anthropic via a sub-dropdown, then model list). **Same UI slot** for “model selection” in the right panel; only the list content switches by mode.

3. **Model catalog**
   - **SLM:** Keep current `modelCatalog` (and any device tier filtering).
   - **LLM:** Add two static lists (or a single catalog with `provider` field):
     - OpenAI: e.g. `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, etc.
     - Anthropic: e.g. `claude-sonnet-4-20250514`, `claude-3-5-haiku-latest`, etc.
   - **modelStore** (or equivalent) stores `provider` + `modelName`. When provider is OpenAI, `modelName` is the OpenAI model id; when Anthropic, the Anthropic id. Same field, different semantics per provider.

4. **Left column conditional**
   - If **provider === 'effgen'**: show current content (Goal Wizard, Prompt Plan Editor, Decompose with effGen, Template Gallery).
   - If **provider !== 'effgen'**: show a **placeholder panel** with the same width (e.g. “No prompt scaffolding in this mode” or “LLM mode — same chat, no decomposition”) so the chat does not move and the layout is identical. Optionally hide sidebar items “Goal Wizard”, “Template Gallery” in LLM mode, or show them disabled with a tooltip.

5. **Right panel conditional**
   - **Always:** Same position and style for “model” selection and temperature (and any sliders you want to keep for parity).
   - **SLM mode (effGen):** Show “Reuse loaded model” and the “effGen” card; model list = effGen catalog.
   - **LLM mode:** Show only model dropdown (OpenAI vs Anthropic sub-choice, then model list) + temperature (and optional max tokens). No “Reuse loaded model”, no effGen card.
   - **Model list:** One list per provider; switch list when sidebar mode is SLM vs LLM (and within LLM, by OpenAI vs Anthropic).

6. **ComposerBar**
   - Send: already sends `messages`, `intent`, `promptPlan`, `modelConfig`. Add **`provider`** from store.
   - When provider is effGen: keep sending intent/promptPlan/modelConfig; backend uses them for system prompt and effGen.
   - When provider is OpenAI/Anthropic: backend **ignores** intent/promptPlan for building system message in comparative study (or uses a minimal one); still send so the API contract is one. No change to composer layout or colors.

7. **Clear button**
   - If provider is effGen: clear local chat + call `/api/effgen/clear-memory`.
   - If provider is OpenAI/Anthropic: clear local chat only (no backend memory call).

8. **Session History**
   - Same panel and “Clear chat history” button. When in LLM mode, clear only local store (no clear-memory API).

---

## 6. Comparative Study Usage

- **SLM condition:** In the **left sidebar**, select the **SLM** tab. Use Goal Wizard, Decompose with effGen, templates, prompt plan. Chat uses full compiled prompt. Same chat UI.
- **LLM condition:** In the **left sidebar**, select the **LLM** tab. Left column shows “no scaffolding” placeholder (same width). In the right panel, user selects OpenAI or Anthropic and then model + temperature; no decomposition, no templates, no goal wizard. System prompt minimal/empty. **Same chat area (colors, location).**
- **Controlled:** Same tasks, same layout, same composer; only difference is presence vs. absence of scaffolding and backend (SLM vs LLM). The mode switch (SLM vs LLM) is always visible in the left sidebar.

---

## 7. Implementation Order (No Code Yet)

1. **Backend**
   - Add `provider` to `/api/chat` body; branch to effGen vs. OpenAI vs. Anthropic.
   - Implement OpenAI path (streaming → same SSE format); env `OPENAI_API_KEY`.
   - Implement Anthropic path (streaming → same SSE format); env `ANTHROPIC_API_KEY`.
   - Document env in `.env.example`.

2. **Stores & types**
   - Add `provider` (and optionally `setProvider`) to settings or a small provider store.
   - Extend model catalog (or add separate lists) for OpenAI and Anthropic model ids.

3. **Left sidebar**
   - Add **SLM** and **LLM** tabs at the top of the sidebar (main mode switch). When SLM is active, nav items (Goal Wizard, etc.) apply; when LLM is active, left column shows placeholder.

4. **Right panel**
   - Model list that switches by mode (SLM → effGen catalog; LLM → OpenAI/Anthropic choice + model list). Same “model selection” slot.
   - Hide effGen-only card and “Reuse loaded model” when in LLM mode.

5. **Left column**
   - When LLM tab is selected, render placeholder (no scaffolding) with same width; optionally hide or disable nav items for Goal Wizard / Templates in LLM mode (or leave them visible but disabled with tooltip).

6. **ComposerBar & clear**
   - Send: include `provider`; clear: call clear-memory only when provider is effGen.

7. **Testing**
   - With `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` set, switch provider and send messages; confirm same chat layout and SSE handling; confirm LLM mode has no decomposition/scaffolding in UI.

---

## 8. Optional Later

- **System prompt for LLM:** If the study later wants a “neutral” system prompt for LLM (e.g. one line), add a study config or env (e.g. `LLM_SYSTEM_PROMPT`) and use it only when provider is OpenAI/Anthropic.
- **Logging / telemetry:** Log provider and model (not content) for study analytics if needed.

---

## 9. Summary

| Layer | Change |
|-------|--------|
| **API** | `/api/chat` accepts `provider`; branches to effGen, OpenAI, or Anthropic; same SSE response shape. |
| **Env** | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (and optionally `LLM_SYSTEM_PROMPT`). |
| **UI (same)** | Chat + composer position, colors, layout; right panel position. |
| **UI (conditional)** | **Left sidebar** = SLM vs LLM tabs (main mode switch); left column = scaffolding (SLM) vs. placeholder (LLM); right panel = model list by mode, effGen card only when SLM. |
| **Study** | SLM = full scaffolding + effGen; LLM = same interface, no scaffolding, minimal system prompt. |

If you confirm this plan (or specify preferences, e.g. where exactly the provider selector should go), the next step is to implement it in code following this order.
