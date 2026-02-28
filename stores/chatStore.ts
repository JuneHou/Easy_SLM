import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/types/chat.types";
import { generateId } from "@/lib/utils";

const CHAT_STORAGE_KEY = "easy-slm-chat";

interface ChatState {
  messages: ChatMessage[];
  streamingContent: string | null;
  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  appendStreaming: (chunk: string) => void;
  commitStreaming: (meta?: ChatMessage["meta"]) => void;
  clearStreaming: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: CHAT_STORAGE_KEY,
      partialize: (state) => ({ messages: state.messages }),
    }
  )
);
