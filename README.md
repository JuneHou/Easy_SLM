# SLM Prompting Tool (Novice-Friendly)

A single-page web app that helps users without domain knowledge use small/local language models (SLMs) by reducing the "Gulf of Envisioning" through:

- **DG1:** Translate user intentions into concrete goals  
- **DG2:** Scaffold user prompt design  
- **DG3:** Guided selection of appropriate models  
- **DG4:** Welcoming, non-overwhelming interface (progressive disclosure, jargon-free controls)

## Tech stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand, Lucide React
- **Backend (demo):** Next.js Route Handlers, REST + SSE for streaming
- **Storage:** Local-only (in-memory / can be extended to IndexedDB or localStorage)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
slm-prompting-tool/
├── app/
│   ├── page.tsx              # One-page demo
│   ├── layout.tsx             # Theme provider + shell
│   ├── globals.css            # Design tokens (dark/light)
│   └── api/chat/route.ts      # POST → SSE stream (mock or Ollama-compatible)
├── components/
│   ├── SidebarNav.tsx
│   ├── GoalWizardModal.tsx
│   ├── IntentSpecRibbon.tsx
│   ├── TemplateGallery.tsx
│   ├── PromptPlanEditor.tsx
│   ├── ChatPanel.tsx
│   ├── ComposerBar.tsx
│   ├── RightInspector.tsx
│   ├── ModelRecommendationPanel.tsx
│   ├── SimpleControls.tsx
│   ├── AdvancedControlsAccordion.tsx
│   ├── CompareDrawer.tsx
│   ├── ToastProvider.tsx
│   ├── PromptCodeViewer.tsx
│   └── ui/                    # Button, Card, Accordion, Slider, Toast
├── stores/                    # Zustand: intent, promptPlan, model, chat, run
├── types/                     # intent, prompt, model, chat
└── lib/
    ├── promptCompiler.ts
    ├── modelCatalog.ts
    ├── sseClient.ts
    ├── theme.ts
    └── utils.ts
```

## Demo use cases

1. Explain a lab procedure as a checklist for a rural clinic assistant  
2. Summarize a paragraph for a non-expert audience without jargon  
3. Extract key fields into JSON from a short note  
4. Rewrite a message politely with constraints (short / formal / no extra claims)

## API

- **POST /api/chat** — Body: `{ messages: [{ role, content }], model? }`. Responds with SSE stream (`data: {"text":"..."}` then `data: [DONE]`). Replace the mock in `app/api/chat/route.ts` with an Ollama-compatible or OpenAI adapter for real SLM calls.
