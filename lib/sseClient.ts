export interface StreamCallbacks {
  onChunk?: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export async function streamChat(
  url: string,
  body: { messages: { role: string; content: string }[]; model?: string },
  callbacks: StreamCallbacks
): Promise<void> {
  const controller = new AbortController();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      callbacks.onError?.(new Error(`HTTP ${res.status}: ${text}`));
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
      callbacks.onError?.(new Error("No response body"));
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            callbacks.onDone?.();
            return;
          }
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) callbacks.onChunk?.(parsed.text);
          } catch {
            // skip malformed
          }
        }
      }
    }
    callbacks.onDone?.();
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
