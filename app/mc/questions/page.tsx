"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoundQuestionsModal } from "@/components/questions/RoundQuestionsModal";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import type { Round } from "@/types/game";

const ROUNDS: { value: Round; label: string; subtitle: string; gradient: string }[] = [
  { value: "ROUND1", label: "Vòng 1", subtitle: "Khơi nguồn năng lượng", gradient: "from-cyan-500 via-blue-600 to-indigo-600" },
  { value: "ROUND2", label: "Vòng 2", subtitle: "Hành trình Giọt Dầu", gradient: "from-emerald-500 via-teal-600 to-cyan-600" },
  { value: "ROUND3", label: "Vòng 3", subtitle: "Tăng tốc vận hành", gradient: "from-lime-500 via-green-600 to-emerald-600" },
  { value: "ROUND4", label: "Vòng 4", subtitle: "Chinh phục đỉnh cao", gradient: "from-amber-500 via-orange-600 to-yellow-600" },
];

export default function MCQuestionsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [packageData, setPackageData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    if (selectedRound === "ROUND2") {
      loadRound2Package();
    }
  }, [selectedRound]);

  const loadRound2Package = async () => {
    setLoading(true);
    try {
      // Tìm package số 1 của Round 2
      const res = await fetch(`/api/packages?round=ROUND2`);
      const packages = await res.json();
      
      // Tìm package số 1, nếu không có thì tạo mới
      let pkg = packages.find((p: any) => p.number === 1);
      
      if (!pkg) {
        // Tự động tạo package số 1
        const createRes = await fetch("/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: 1,
            round: "ROUND2",
          }),
        });
        
        if (createRes.ok) {
          pkg = await createRes.json();
        } else {
          const error = await createRes.json();
          showToast(error.error || "Lỗi khi tạo gói câu hỏi", "error");
          setLoading(false);
          return;
        }
      }
      
      setPackageData(pkg);
    } catch (error) {
      console.error("Error loading Round 2 package:", error);
      showToast("Lỗi khi tải gói câu hỏi", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPackage = () => {
    if (packageData?._id) {
      router.push(`/mc/round2/${packageData._id}`);
    }
  };

  return (
    <div className="p-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Quản lý câu hỏi</h1>
          {selectedRound && (
            <button
              onClick={() => setSelectedRound(null)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ← Quay lại
            </button>
          )}
        </div>
      </motion.div>

      {!selectedRound ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {ROUNDS.map((round, index) => (
            <motion.button
              key={round.value}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: index * 0.08,
                duration: 0.3,
                type: "spring",
                stiffness: 150,
                damping: 20,
              }}
              whileHover={{
                scale: 1.05,
                y: -5,
                transition: { duration: 0.15 },
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedRound(round.value)}
              className={`group relative p-8 bg-gradient-to-br ${round.gradient} rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl overflow-hidden`}
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
              
              {/* Content */}
              <motion.div
                className="relative z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08 + 0.05 }}
              >
                <div className="text-3xl font-bold text-white mb-2">{round.label}</div>
                <div className="text-sm text-white/80 font-medium">{round.subtitle}</div>
              </motion.div>
              
              {/* Decorative corner */}
              <motion.div
                className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-bl-full"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08 + 0.1, duration: 0.2 }}
              />
            </motion.button>
          ))}
        </div>
      ) : selectedRound === "ROUND2" ? (
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <h2 className="text-2xl font-bold mb-2">Vòng 2 - Hành trình Giọt Dầu</h2>
            <p className="text-gray-400">
              Cài đặt câu hỏi và hình ảnh cho Round 2
            </p>
          </motion.div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Đang tải...</div>
          ) : packageData ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div onClick={handleSetupPackage}>
                <Card
                  className={`cursor-pointer transition-all hover:shadow-xl ${
                    packageData.round2Meta
                      ? "border-green-500/50 bg-gradient-to-br from-green-900/20 to-emerald-900/20"
                      : "border-yellow-500/50 bg-gradient-to-br from-yellow-900/20 to-orange-900/20"
                  }`}
                >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Round 2 Setup</h3>
                    {packageData.round2Meta ? (
                      <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
                        ✓ Đã setup
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-full text-sm font-medium border border-yellow-500/30">
                        ⚠ Cần setup
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-300 mb-6">
                    {packageData.round2Meta ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Ảnh CNV đã upload</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span>CNV Answer: {packageData.round2Meta?.cnvAnswer || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span>3 câu hàng ngang đã tạo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Center hint đã tạo</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">○</span>
                          <span>Chưa upload ảnh CNV</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">○</span>
                          <span>Chưa nhập CNV answer</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">○</span>
                          <span>Chưa tạo câu hỏi hàng ngang</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">○</span>
                          <span>Chưa tạo center hint</span>
                        </div>
                      </>
                    )}
                  </div>

                  {packageData.status === "completed" && (
                    <div className="mb-4 pt-4 border-t border-gray-700">
                      <span className="text-gray-400 text-sm">Đã thi xong</span>
                    </div>
                  )}

                  {packageData.status === "in_progress" && (
                    <div className="mb-4 pt-4 border-t border-gray-700">
                      <span className="text-blue-400 text-sm">Đang thi</span>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetupPackage();
                    }}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                      packageData.round2Meta
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-yellow-600 hover:bg-yellow-700 text-white"
                    }`}
                  >
                    {packageData.round2Meta ? "Chỉnh sửa Setup" : "Bắt đầu Setup Round 2"}
                  </button>
                </div>
                </Card>
              </div>
            </motion.div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-xl text-gray-300 mb-4">Đang tạo gói câu hỏi...</p>
            </Card>
          )}
        </div>
      ) : (
        <RoundQuestionsModal
          isOpen={!!selectedRound}
          onClose={() => setSelectedRound(null)}
          round={selectedRound}
        />
      )}
    </div>
  );
}
