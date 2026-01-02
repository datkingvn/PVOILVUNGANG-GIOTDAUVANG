"use client";

import { useConfirmStore } from "@/store/confirmStore";

export function useConfirm() {
  const showConfirm = useConfirmStore((state) => state.showConfirm);
  const isOpen = useConfirmStore((state) => state.isOpen);
  const message = useConfirmStore((state) => state.message);
  const close = useConfirmStore((state) => state.close);
  const handleConfirm = useConfirmStore((state) => state.handleConfirm);

  return {
    isOpen,
    message,
    confirm: showConfirm,
    close,
    handleConfirm,
  };
}

