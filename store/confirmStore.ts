import { create } from "zustand";

interface ConfirmState {
  isOpen: boolean;
  message: string;
  onConfirm: (() => void) | null;
  showConfirm: (message: string, onConfirm: () => void) => void;
  close: () => void;
  handleConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  message: "",
  onConfirm: null,
  showConfirm: (message, onConfirm) => {
    set({
      isOpen: true,
      message,
      onConfirm,
    });
  },
  close: () => {
    set({
      isOpen: false,
      message: "",
      onConfirm: null,
    });
  },
  handleConfirm: () => {
    const state = useConfirmStore.getState();
    if (state.onConfirm) {
      state.onConfirm();
    }
    set({
      isOpen: false,
      message: "",
      onConfirm: null,
    });
  },
}));

