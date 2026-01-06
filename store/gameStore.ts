import { create } from "zustand";
import type { GameState } from "@/types/game";

interface GameStore {
  state: GameState | null;
  setState: (state: GameState | null) => void;
  serverTimeOffset: number; // Offset between server time and client time (serverTime - clientTime)
  setServerTimeOffset: (offset: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
  serverTimeOffset: 0,
  setServerTimeOffset: (offset) => set({ serverTimeOffset: offset }),
}));

