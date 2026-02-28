import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  /** When true, effGen reuses the loaded model between messages (no reload while model unchanged). */
  reuseLoadedModel: boolean;
  setReuseLoadedModel: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      reuseLoadedModel: true,
      setReuseLoadedModel: (reuseLoadedModel) => set({ reuseLoadedModel }),
    }),
    { name: "easy-slm-settings" }
  )
);
