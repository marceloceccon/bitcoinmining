"use client";

import { create } from "zustand";
import { fetchNetworkData, type NetworkData } from "./networkData";

interface NetworkStore {
  data: NetworkData | null;
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  data: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const data = await fetchNetworkData();
    set({ data, loading: false });
  },
}));
