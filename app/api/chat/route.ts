import { NextRequest, NextResponse } from "next/server";

// Demo: stream back a mock response. Replace with real Ollama/OpenAI SSE.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages as { role: string; content: string }[] | undefined;
    const _model = body.model as string | undefined;

    if (!messages?.length) {
      return NextResponse.json(
        { error: "messages required" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const lastUser = messages.filter((m) => m.role === "user").pop();
        const reply =
          lastUser?.content ||
          "No user message.";
        // Mock: send reply in small chunks to simulate streaming
        const words = reply.split(/(\s+)/);
        let i = 0;
        const tick = () => {
          if (i >= words.length) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          const chunk = words[i];
          i++;
          controller.enqueue(
            encoder.encode("data: " + JSON.stringify({ text: chunk }) + "\n\n")
          );
          setTimeout(tick, 30);
        };
        setTimeout(tick, 100);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
