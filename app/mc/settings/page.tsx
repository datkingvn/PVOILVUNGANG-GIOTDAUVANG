"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/hooks/useToast";
import { motion } from "framer-motion";
import { RotateCcw, Info } from "lucide-react";

export default function MCSettingsPage() {
  const router = useRouter();
  const { confirm, isOpen, message, close, handleConfirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/mc", { method: "GET" });
        if (!res.ok) {
          router.push("/login/mc");
        }
      } catch {
        router.push("/login/mc");
      }
    }
    checkAuth();
  }, [router]);

  async function handleResetGame() {
    confirm("Bạn có chắc chắn muốn reset toàn bộ game? Hành động này không thể hoàn tác.", async () => {
      try {
        const res = await fetch("/api/game-control/reset", { method: "POST" });
        if (res.ok) {
          showToast("Reset game thành công", "success");
        } else {
          showToast("Reset game thất bại", "error");
        }
      } catch (error) {
        showToast("Lỗi kết nối", "error");
      }
    });
  }

  return (
    <div className="p-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-6">Cài đặt</h1>
      </motion.div>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 rounded-lg">
                <RotateCcw size={20} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold">Quản lý Game</h2>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Reset Game</h3>
                <p className="text-gray-400 mb-4">
                  Reset toàn bộ trạng thái game, điểm số và gói câu hỏi về trạng thái ban đầu.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleResetGame}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Reset Game
                </motion.button>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg">
                <Info size={20} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold">Thông tin hệ thống</h2>
            </div>
            <div className="space-y-3 text-gray-300">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <span className="font-semibold text-white">Phiên bản:</span>{" "}
                <span className="text-amber-400">1.0.0</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.3 }}
              >
                <span className="font-semibold text-white">Author:</span>{" "}
                <span className="text-cyan-400">Mạnh Đạt</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <span className="font-semibold text-white">Trạng thái:</span>{" "}
                <span className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm font-medium">
                  Đang hoạt động
                </span>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </div>

      <ConfirmModal />
    </div>
  );
}
