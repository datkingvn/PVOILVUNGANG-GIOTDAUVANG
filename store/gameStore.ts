import { create } from "zustand";
import type { GameState } from "@/types/game";

interface GameStore {
  state: GameState | null;
  setState: (state: GameState | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
}));

