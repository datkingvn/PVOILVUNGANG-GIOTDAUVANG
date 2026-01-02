"use client";

import { useToastStore } from "@/store/toastStore";

export function useToast() {
  const showToast = useToastStore((state) => state.showToast);
  return { showToast };
}

