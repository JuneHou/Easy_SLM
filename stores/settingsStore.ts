import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatProvider = "effgen" | "openai" | "anthropic";

interface SettingsState {
  /** When true, effGen reuses the loaded model between messages (no reload while model unchanged). */
  reuseLoadedModel: boolean;
  setReuseLoadedModel: (value: boolean) => void;
  /** Backend for chat: effgen (SLM) | openai | anthropic (LLM). Controls sidebar SLM/LLM mode. */
  chatProvider: ChatProvider;
  setChatProvider: (provider: ChatProvider) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      reuseLoadedModel: true,
      setReuseLoadedModel: (reuseLoadedModel) => set({ reuseLoadedModel }),
      chatProvider: "effgen",
      setChatProvider: (chatProvider) => set({ chatProvider }),
    }),
    { name: "easy-slm-settings" }
  )
);
