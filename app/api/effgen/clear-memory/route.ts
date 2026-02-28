import { NextRequest, NextResponse } from "next/server";

const EFFGEN_BASE_URL = process.env.EFFGEN_BASE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const model = typeof body.model === "string" ? body.model : undefined;

    const res = await fetch(`${EFFGEN_BASE_URL}/clear_memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model ?? null }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `effGen /clear_memory failed: ${res.status} ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Failed to reach effGen: ${message}` },
      { status: 502 }
    );
  }
}
