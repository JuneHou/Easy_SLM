import { NextRequest, NextResponse } from "next/server";

const EFFGEN_BASE_URL = process.env.EFFGEN_BASE_URL || "http://localhost:8000";

interface DecomposeBody {
  intent?: Record<string, unknown>;
  current_prompt_text: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DecomposeBody;
    const { intent, current_prompt_text } = body;

    if (current_prompt_text === undefined) {
      return NextResponse.json(
        { error: "current_prompt_text required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${EFFGEN_BASE_URL}/decompose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: intent ?? null,
        current_prompt_text: String(current_prompt_text),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `effGen /decompose failed: ${res.status} ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Failed to reach effGen at ${EFFGEN_BASE_URL}. ${message}`,
      },
      { status: 502 }
    );
  }
}
