import { NextRequest, NextResponse } from "next/server";

const EFFGEN_BASE_URL = process.env.EFFGEN_BASE_URL || "http://localhost:8000";

export type ChatProvider = "effgen" | "openai" | "anthropic";

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
  /** Backend for chat: effgen (SLM) | openai | anthropic (LLM). Default effgen. */
  provider?: ChatProvider;
}

/** Build OpenAI chat messages from body: minimal system for LLM study; user/assistant from messages. */
function buildOpenAIMessages(
  bodyMessages: { role: string; content: string }[],
  _intent: IntentSpec | undefined,
  _promptPlan: PromptPlan | undefined
): { role: "system" | "user" | "assistant"; content: string }[] {
  const systemContent = "You are a helpful assistant.";
  const openAIMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemContent },
  ];
  for (const m of bodyMessages) {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
    if (role === "system") continue; // already set minimal system above
    openAIMessages.push({ role: role as "user" | "assistant", content: m.content });
  }
  return openAIMessages;
}

/** Stream OpenAI chat completions and convert to our SSE format (data: {"text":"..."} then data: [DONE]). */
async function streamOpenAI(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  temperature: number,
  maxTokens: number,
  apiKey: string
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${text}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  return new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) controller.enqueue(encoder.encode("data: " + JSON.stringify({ text }) + "\n\n"));
              } catch {
                // skip
              }
            }
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

/** Stream Anthropic messages and convert to our SSE format. */
async function streamAnthropic(
  model: string,
  bodyMessages: { role: string; content: string }[],
  _systemContent: string,
  maxTokens: number,
  apiKey: string,
  temperature: number = 0.7
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  // Anthropic: only user/assistant in messages; system is separate. For study we use minimal system.
  const anthropicMessages = bodyMessages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const messagesToSend =
    anthropicMessages.length > 0 ? anthropicMessages : [{ role: "user" as const, content: "No message." }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: "You are a helpful assistant.",
      messages: messagesToSend,
      stream: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  return new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              try {
                const parsed = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta.text) {
                  controller.enqueue(
                    encoder.encode("data: " + JSON.stringify({ text: parsed.delta.text }) + "\n\n")
                  );
                }
              } catch {
                // skip
              }
            }
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const messages = body.messages;
    const intent = body.intent;
    const promptPlan = body.promptPlan;
    const modelConfig = body.modelConfig;
    const provider: ChatProvider = body.provider ?? "effgen";

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
    const DEFAULT_SLM = "Qwen/Qwen2.5-3B-Instruct";
    const requestedModel = modelConfig?.modelName ?? DEFAULT_SLM;
    // Never forward a cloud model name to effGen — it cannot load OpenAI/Anthropic
    // models and the attempt corrupts its event loop.
    const isCloudModel = /gpt|claude|anthropic|openai/i.test(requestedModel);
    const model = provider === "effgen" && isCloudModel ? DEFAULT_SLM : requestedModel;
    const temperature = modelConfig?.params?.temperature ?? 0.7;
    const maxTokens = modelConfig?.params?.maxTokens ?? 1024;
    const max_iterations = 10;
    const reuseLoadedModel = body.reuseLoadedModel !== false;

    const encoder = new TextEncoder();

    // --- LLM: OpenAI
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY is not set. Add it to your .env." },
          { status: 502 }
        );
      }
      const openAIMessages = buildOpenAIMessages(messages, intent, promptPlan);
      try {
        const stream = await streamOpenAI(model, openAIMessages, temperature, maxTokens, apiKey);
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `OpenAI: ${message}` }, { status: 502 });
      }
    }

    // --- LLM: Anthropic
    if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY is not set. Add it to your .env." },
          { status: 502 }
        );
      }
      try {
        const stream = await streamAnthropic(model, messages, systemContent, maxTokens, apiKey, temperature);
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Anthropic: ${message}` }, { status: 502 });
      }
    }

    // --- SLM: effGen
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
