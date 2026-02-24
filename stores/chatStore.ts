import { create } from "zustand";
import type { ChatMessage } from "@/types/chat.types";
import { generateId } from "@/lib/utils";

interface ChatState {
  messages: ChatMessage[];
  streamingContent: string | null;
  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  appendStreaming: (chunk: string) => void;
  commitStreaming: (meta?: ChatMessage["meta"]) => void;
  clearStreaming: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingContent: null,
  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          ...msg,
          id: generateId(),
          createdAt: Date.now(),
        },
      ],
    })),
  appendStreaming: (chunk) =>
    set((s) => ({
      streamingContent: (s.streamingContent ?? "") + chunk,
    })),
  commitStreaming: (meta) =>
    set((s) => {
      if (s.streamingContent == null) return s;
      const assistant: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: s.streamingContent,
        createdAt: Date.now(),
        meta,
      };
      return {
        messages: [...s.messages, assistant],
        streamingContent: null,
      };
    }),
  clearStreaming: () => set({ streamingContent: null }),
  clearMessages: () => set({ messages: [], streamingContent: null }),
}));
