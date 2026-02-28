import { create } from "zustand";
import type { ModelProfile, DeviceTier } from "@/types/model.types";
import { getShortlist, getModelById } from "@/lib/modelCatalog";

const defaultProfile: ModelProfile = {
  provider: "local",
  modelName: "Qwen/Qwen2.5-3B-Instruct",
  deviceTier: "gpu",
  params: {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024,
  },
};

interface ModelState {
  profile: ModelProfile;
  deviceTier: DeviceTier;
  shortlist: ReturnType<typeof getShortlist>;
  setDeviceTier: (tier: DeviceTier) => void;
  selectModel: (catalogId: string) => void;
  setParams: (params: Partial<ModelProfile["params"]>) => void;
  refreshShortlist: () => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  profile: defaultProfile,
  deviceTier: "gpu",
  shortlist: getShortlist("gpu"),
  setDeviceTier: (deviceTier) =>
    set({
      deviceTier,
      shortlist: getShortlist(deviceTier),
    }),
  selectModel: (id) => {
    const entry = getModelById(id);
    if (!entry) return;
    set({
      profile: {
        provider: entry.provider,
        modelName: entry.modelName,
        deviceTier: entry.deviceTier,
        params: { ...entry.defaultParams },
      },
    });
  },
  setParams: (params) =>
    set((s) => ({
      profile: {
        ...s.profile,
        params: { ...s.profile.params, ...params },
      },
    })),
  refreshShortlist: () =>
    set({ shortlist: getShortlist(get().deviceTier) }),
}));
