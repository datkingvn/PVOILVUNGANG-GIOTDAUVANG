"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, Info } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
              ${
                toast.type === "success"
                  ? "bg-green-600"
                  : toast.type === "error"
                  ? "bg-red-600"
                  : "bg-blue-600"
              }
            `}
          >
            {toast.type === "success" && <CheckCircle size={20} />}
            {toast.type === "error" && <XCircle size={20} />}
            {toast.type === "info" && <Info size={20} />}
            <span className="text-white">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

