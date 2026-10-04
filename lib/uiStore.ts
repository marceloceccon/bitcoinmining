"use client";

import { create } from "zustand";

/** Cross-component UI requests (not farm state, never persisted). */
interface UiStore {
  /** The hero's "Drop a pin on the map" asks the Thermal tab to open the map once it mounts */
  mapRequested: boolean;
  requestMap: () => void;
  consumeMapRequest: () => boolean;
}

export const useUiStore = create<UiStore>((set, get) => ({
  mapRequested: false,
  requestMap: () => set({ mapRequested: true }),
  consumeMapRequest: () => {
    const requested = get().mapRequested;
    if (requested) set({ mapRequested: false });
    return requested;
  },
}));
