"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RoundQuestionsModal } from "@/components/questions/RoundQuestionsModal";
import { motion } from "framer-motion";
import type { Round } from "@/types/game";

const ROUNDS: { value: Round; label: string; subtitle: string; gradient: string }[] = [
  { value: "ROUND1", label: "Vòng 1", subtitle: "Khơi nguồn năng lượng", gradient: "from-cyan-500 via-blue-600 to-indigo-600" },
  { value: "ROUND2", label: "Vòng 2", subtitle: "Hành trình Giọt Dầu", gradient: "from-emerald-500 via-teal-600 to-cyan-600" },
  { value: "ROUND3", label: "Vòng 3", subtitle: "Tăng tốc vận hành", gradient: "from-lime-500 via-green-600 to-emerald-600" },
  { value: "ROUND4", label: "Vòng 4", subtitle: "Chinh phục đỉnh cao", gradient: "from-amber-500 via-orange-600 to-yellow-600" },
];

export default function MCQuestionsPage() {
  const router = useRouter();
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);

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

  return (
    <div className="p-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-6">Quản lý câu hỏi</h1>
      </motion.div>

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

      {selectedRound && (
        <RoundQuestionsModal
          isOpen={!!selectedRound}
          onClose={() => setSelectedRound(null)}
          round={selectedRound}
        />
      )}
    </div>
  );
}
