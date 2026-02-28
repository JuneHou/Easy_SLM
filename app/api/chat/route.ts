import { NextRequest, NextResponse } from "next/server";

const EFFGEN_BASE_URL = process.env.EFFGEN_BASE_URL || "http://localhost:8000";

interface IntentSpec {
  goalText?: string;
  goalFraming?: string;
  audience?: string;
  outputFormat?: string;
  constraints?: string[];
  successCriteria?: string[];
}

interface PromptPlan {
  steps?: string[];
  compiledPrompt?: string;
}

interface ModelConfig {
  modelName?: string;
  params?: { temperature?: number; topP?: number; maxTokens?: number };
}

interface ChatBody {
  messages: { role: string; content: string }[];
  intent?: IntentSpec;
  promptPlan?: PromptPlan;
  modelConfig?: ModelConfig;
  /** When true, effGen reuses cached model (no reload). When false, sends force_reload. */
  reuseLoadedModel?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const messages = body.messages;
    const intent = body.intent;
    const promptPlan = body.promptPlan;
    const modelConfig = body.modelConfig;

    if (!messages?.length) {
      return NextResponse.json(
        { error: "messages required" },
        { status: 400 }
      );
    }

    const lastUser = messages.filter((m) => m.role === "user").pop();
    const task = lastUser?.content?.trim() || "No user message.";
    const systemContent =
      promptPlan?.compiledPrompt ||
      (intent
        ? `Goal: ${intent.goalFraming ?? intent.goalText ?? "No goal"}. Output format: ${intent.outputFormat ?? "paragraph"}.`
        : "You are a helpful assistant.");
    const model = modelConfig?.modelName ?? "Qwen/Qwen2.5-3B-Instruct";
    const temperature = modelConfig?.params?.temperature ?? 0.7;
    const max_iterations = 10;
    const reuseLoadedModel = body.reuseLoadedModel !== false;

    const encoder = new TextEncoder();

    try {
      const effgenRes = await fetch(`${EFFGEN_BASE_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          model,
          system_prompt: systemContent,
          temperature,
          max_iterations,
          force_reload: !reuseLoadedModel,
        }),
      });

      if (!effgenRes.ok) {
        const text = await effgenRes.text();
        return NextResponse.json(
          { error: `effGen /run failed: ${effgenRes.status} ${text}` },
          { status: 502 }
        );
      }

      const data = (await effgenRes.json()) as {
        output?: string;
        success?: boolean;
        metadata?: unknown;
      };
      const output = data.output ?? (data.success === false ? "No output." : "");

      const stream = new ReadableStream({
        start(controller) {
          if (output) {
            controller.enqueue(
              encoder.encode("data: " + JSON.stringify({ text: output }) + "\n\n")
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (fetchErr) {
      const message =
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return NextResponse.json(
        {
          error: `Failed to reach effGen at ${EFFGEN_BASE_URL}. Ensure effgen serve is running. ${message}`,
        },
        { status: 502 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
