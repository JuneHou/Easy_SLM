# SLM Prompting Tool (Novice-Friendly)

A single-page web app that helps users without domain knowledge use small/local language models (SLMs) by reducing the "Gulf of Envisioning" through:

- **DG1:** Translate user intentions into concrete goals  
- **DG2:** Scaffold user prompt design  
- **DG3:** Guided selection of appropriate models  
- **DG4:** Welcoming, non-overwhelming interface (progressive disclosure, jargon-free controls)

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand, Lucide React
- **Backend (demo):** Next.js Route Handlers, REST + SSE for streaming
- **Storage:** Chat history persisted in localStorage; intent/prompt/model state is in-memory

## Getting Started

### 1. Install and run the web app

**Node.js 18 or newer is required** (Next 14 and the app use features that need Node 18+). Your current shell may be using an older Node (e.g. conda env `causal` often has Node 12). Check with `node -v`; you must see v18.x or v20.x before running `npm install`.

- **nvm:** `nvm install 18` then `nvm use 18`, or in this project run `nvm use` (see `.nvmrc`).
- **Conda:** use an env with Node 18+, e.g. `conda create -n slm nodejs=20 -c conda-forge` then `conda activate slm`.
- **System:** install Node 20 LTS from [nodejs.org](https://nodejs.org/).

If you run `npm install` with Node &lt; 18, install will fail (engine-strict). Fix the Node version first, then `rm -rf node_modules package-lock.json` and run `npm install` again.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If you get `next: not found`, run `npm install` in the project root so the local Next.js (in `node_modules`) is used.

### 2. (Optional) effGen backend for chat and decomposition

Chat and **Decompose with effGen** are powered by [effGen](https://github.com/ctrl-gaurav/effGen). To use them:

1. Clone and run effGen locally (e.g. port 8000). Use a **virtual environment or conda env** so installs go into the env instead of system Python (avoiding permission errors).

   **Option A – Conda (e.g. env at `/home/jun/Workspace/envs/causal`):**

   ```bash
   conda activate /home/jun/Workspace/envs/causal
   cd /path/to/effGen
   which python   # should show .../envs/causal/bin/python
   python -m pip install -e .
   effgen serve --port 8000
   ```

   Use `python -m pip install -e .` (not plain `pip install -e .`) so the install definitely uses the active env’s Python and installs into that env.

   **Option B – venv:**

   ```bash
   cd /path/to/effGen
   python3 -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -e .
   effgen serve --port 8000
   ```

   **Option C – no env:** `pip install -e . --user` (installs into your user site-packages).

2. Point the app at the effGen API. Copy `.env.example` to `.env.local` and set:

   ```bash
   EFFGEN_BASE_URL=http://localhost:8000
   ```

   If unset, the app defaults to `http://localhost:8000`.

Without effGen, **Send** and **Decompose with effGen** will return connection errors until the server is running.

## Interface Guide

### Layout Overview

The interface is divided into four main sections:

1. **Left Sidebar** - Navigation menu
2. **Left Column** - Goal Wizard & Prompt Plan Editor
3. **Center Column** - Chat interface (messages and composer)
4. **Right Panel** - Model recommendations and controls

---

### 1. Left Sidebar Navigation

The collapsible sidebar provides access to different sections:

#### **Collapse/Expand Button** (top-right of sidebar)
- Click the chevron icon to collapse or expand the sidebar
- Collapsed: Shows only icons
- Expanded: Shows icons and labels

#### **Navigation Items:**

- **🎯 Goal Wizard** - Opens the Goal Wizard interface in the left column
- **📋 Template Gallery** - Displays pre-built prompt templates
- **📖 Examples** - Shows demo use cases
- **🕐 Session History** - Chat is saved in the browser (localStorage). View message count and clear history.
- **⚙️ Settings** - Application settings (demo placeholder)

---

### 2. Goal Wizard & Prompt Plan Editor (Left Column)

#### **Open Goal Wizard Button**
- **Location:** Top of the Prompt Plan Editor section
- **Function:** Opens a modal wizard to define your goal and intent
- **When to use:** Start here to set up your task before creating prompts

#### **Goal Wizard Modal**

A two-step wizard that helps you define your intent:

**Step 1: Define Your Goal**
- **One-sentence goal** (textarea) - Enter a clear description of what you want to achieve
- **Reframe your goal** (optional) - Select one of three framing options:
  - "Turn my idea into a clear, step-by-step task for the model."
  - "Refine my goal so the model knows exactly what to produce."
  - "Make my intention specific enough to get consistent results."
- **Next Button** - Proceeds to Step 2

**Step 2: Configure Details**
- **Audience Selection** (button group):
  - "Just for me" (self)
  - "For my team" (team)
  - "For a general audience" (public)
- **Output Format** (button group):
  - Paragraph
  - Checklist
  - Table
  - JSON
- **Constraints** (input field + Add button):
  - Type a constraint and press Enter or click "Add"
  - Remove constraints by clicking the × on each tag
- **Success Criteria** (input field + Add button):
  - Add criteria like "Concise, step-by-step, no jargon"
  - Remove criteria using the "Remove" button
- **Back Button** - Returns to Step 1
- **Save intent Button** - Saves your configuration and closes the modal
- **Close Button (X)** - Closes the modal without saving

#### **Prompt Plan Editor**

**Header Section:**
- **Generate variants (A/B/C) Button** - Creates three prompt variants for comparison:
  - Variant A: More strict
  - Variant B: Shorter
  - Variant C: More explicit
  - Opens a comparison drawer where you can pick the best variant

**Instructions Textarea:**
- Enter your prompt instructions (one per line or freeform)
- Supports multi-line input
- Placeholder: "Enter or edit steps..."

**Action Buttons:**
- **Decompose with effGen Button** (primary) - Sends the current prompt text to effGen, which returns subtasks; the Steps list is replaced by the decomposed steps and "Decomposition details" shows strategy and subtask info. Requires effGen server.
- **Break into steps Button** - Local fallback: automatically breaks your text into steps (no server).
- **Add step Button** - Adds the current textarea content as a new step

**Steps List:**
Each step in the list has three action buttons:
- **↑ Button** - Move step up (disabled for first step)
- **↓ Button** - Move step down (disabled for last step)
- **× Button** - Remove the step

**Compiled Prompt Preview (Accordion):**
- Click to expand/collapse
- Shows the compiled prompt that will be sent to the model
- Displays "Broken into steps" section when steps exist

**Decomposition details (Accordion):**
- Appears after using **Decompose with effGen**
- Shows strategy, number of subtasks, and each subtask’s description and expected output

---

### 3. Template Gallery

Access via **📋 Template Gallery** in the sidebar.

**Available Templates:**
- **Checklist / Steps** - "Use template" button
- **Summarize for audience** - "Use template" button
- **Extract to JSON** - "Use template" button
- **Rewrite with constraints** - "Use template" button

**Use template Button:**
- Applies the template's steps and configuration to your prompt plan
- Automatically closes the template gallery

---

### 4. Chat Interface (Center Column)

#### **Chat Panel**
- Displays conversation history
- Shows user messages and assistant responses
- Includes metadata (intent version, model snapshot, warnings)

#### **Composer Bar**

**Textarea:**
- Type your message here
- Press **Enter** to send (Shift+Enter for new line)
- Placeholder: "Type your message..."
- Disabled while streaming

**Send Button:**
- Sends your message to the effGen backend (POST /api/chat → effGen `/run`)
- Request includes current intent, prompt plan, and model config; response is streamed as SSE
- Disabled when input is empty or while streaming
- Shows a message icon

**Info Text:**
- "Composer uses your current intent and prompt plan as context. Generate variants from the Prompt plan panel."

---

### 5. Variant Comparison Drawer

Opens automatically when you click **Generate variants (A/B/C)**.

**Layout:**
- Three-column grid showing variants A, B, and C
- Each variant displays:
  - Label (More strict / Shorter / More explicit)
  - Compiled prompt preview
  - **Pick this one Button** - Selects this variant as your prompt plan

**Close Button:**
- Closes the comparison drawer without selecting a variant

---

### 6. Right Inspector Panel

#### **Model Recommendation Panel**
- Displays recommended models based on your intent
- Shows model information and suitability

#### **effGen (Reuse loaded model)**
- **Reuse loaded model** (default on): While the selected model in the recommendation panel does not change, effGen keeps the model in memory and does not reload it for each message. This avoids reload delays and keeps conversation flow. Turn off to force a full model reload on every Send.

#### **Simple Controls**
- Basic model and parameter controls
- Easy-to-use sliders and inputs

#### **Advanced Controls Accordion**
- Expandable section with advanced settings
- Model parameters, temperature, etc.

#### **Quick Benchmark Button** (demo, disabled)
- Placeholder for model benchmarking feature
- Currently shows: "Optional: mock score table for 2–3 models."

---

## Keyboard Shortcuts

- **Enter** (in composer) - Send message
- **Shift + Enter** (in composer) - New line
- **Enter** (in constraint/criteria inputs) - Add item

---

## Project Structure

```
slm-prompting-tool/
├── test-prompts.txt          # Sample prompts for decomposition and chat
├── app/
│   ├── page.tsx              # Main page layout
│   ├── layout.tsx             # Theme provider + shell
│   ├── globals.css            # Design tokens (dark/light)
│   └── api/
│       ├── chat/route.ts           # POST → proxy to effGen /run, SSE stream
│       └── effgen/decompose/route.ts # POST → proxy to effGen /decompose
├── components/
│   ├── SidebarNav.tsx         # Left navigation sidebar
│   ├── GoalWizardModal.tsx    # Goal definition wizard
│   ├── TemplateGallery.tsx    # Pre-built prompt templates
│   ├── PromptPlanEditor.tsx   # Prompt step editor
│   ├── ChatPanel.tsx          # Message display
│   ├── ComposerBar.tsx        # Message input and send
│   ├── RightInspector.tsx     # Model controls panel
│   ├── CompareDrawer.tsx      # Variant comparison
│   ├── ModelRecommendationPanel.tsx
│   ├── SimpleControls.tsx
│   ├── AdvancedControlsAccordion.tsx
│   └── ui/                    # Reusable UI components
├── stores/                     # Zustand state management
│   ├── intentStore.ts         # Intent/goal state
│   ├── promptPlanStore.ts     # Prompt plan state
│   ├── modelStore.ts          # Model selection state
│   ├── chatStore.ts           # Chat history state
│   └── runStore.ts            # Run history state
├── types/                      # TypeScript type definitions
└── lib/
    ├── promptCompiler.ts      # Prompt compilation logic
    ├── modelCatalog.ts        # Model catalog
    ├── sseClient.ts           # SSE streaming client
    ├── theme.ts               # Theme utilities
    └── utils.ts               # General utilities
```

---

## Demo Use Cases

1. **Explain a lab procedure as a checklist for a rural clinic assistant**
   - Use Goal Wizard to set audience and output format
   - Use "Checklist / Steps" template
   - Break instructions into steps

2. **Summarize a paragraph for a non-expert audience without jargon**
   - Set audience to "For a general audience"
   - Use "Summarize for audience" template
   - Add constraint: "No jargon"

3. **Extract key fields into JSON from a short note**
   - Set output format to "JSON"
   - Use "Extract to JSON" template
   - Define extraction steps

4. **Rewrite a message politely with constraints**
   - Use "Rewrite with constraints" template
   - Add constraints: "polite", "short", "formal"
   - Set appropriate output format

---

## API

- **POST /api/chat** — Body: `{ messages, intent?, promptPlan?, modelConfig? }`. Proxies to effGen `POST /run` with task (last user message), system_prompt (from intent + prompt plan), model, temperature. Returns SSE stream (`data: {"text":"..."}` then `data: [DONE]`). Requires `EFFGEN_BASE_URL` pointing at a running effGen server.
- **POST /api/effgen/decompose** — Body: `{ intent?, current_prompt_text }`. Proxies to effGen `POST /decompose`. Returns `{ subtasks, wrapped_prompts, routing_meta }` for the Prompt Plan Editor.

---

## Test prompt

Sample prompts are also in **`test-prompts.txt`** in the project root. Use the steps below to try **Decompose with effGen** and **Send**.

**Decompose with effGen:** The prompt does not need to be long. For multiple steps, structure it so effGen can split it: use **"and"** to list parts (e.g. "Do A and B and C"), use **numbered items** (1. 2. 3.), or include both research/gather and summarize/synthesis wording. A single short sentence often becomes one step.

1. In the Prompt Plan Editor, paste the text below into the instructions textarea.
2. Click **Decompose with effGen** (with effGen running). The steps list should fill with decomposed subtasks; open "Decomposition details" to see the full breakdown.
3. In the composer, type the second prompt and click **Send** to get a streamed reply from effGen.

**Prompt for decomposition (paste into Prompt Plan; no web search needed):**

```
Summarize the key concepts of object-oriented programming and compare classes with interfaces. Then list three best practices for writing clean code and suggest when to use inheritance vs composition.
```

**Prompt for chat (type in composer):**

```
What is 15% tip on a $42.50 bill? Reply in one short sentence.
```

---

## Workflow Example

1. **Start:** Click "Open Goal Wizard" or select "Goal Wizard" from sidebar
2. **Define Goal:** Enter your one-sentence goal in Step 1
3. **Configure:** Set audience, output format, constraints, and success criteria in Step 2
4. **Save:** Click "Save intent" to commit your configuration
5. **Plan Prompt:** Use the Prompt Plan Editor to add or break instructions into steps
6. **Optional:** Use templates or generate variants for comparison
7. **Chat:** Type your message in the composer and click "Send"
8. **Review:** Check the compiled prompt preview to see what's being sent to the model

---

## Features Summary

✅ **Goal Wizard** - Guided intent definition  
✅ **Template Gallery** - Pre-built prompt templates  
✅ **Prompt Plan Editor** - Step-by-step prompt construction; **Decompose with effGen** (DG2)  
✅ **Variant Generation** - Compare multiple prompt versions  
✅ **Real-time Chat** - Stream responses via effGen `/run` (Phase 1)  
✅ **Model Recommendations** - Context-aware model suggestions  
✅ **Progressive Disclosure** - Advanced options hidden by default  
✅ **Dark/Light Theme** - Theme support (via layout)

---

## Contributing

This is a demo project. Feel free to extend it with:
- Persistent storage (IndexedDB/localStorage)
- Session history functionality
- Model benchmarking
- Additional templates
- Export/import functionality
