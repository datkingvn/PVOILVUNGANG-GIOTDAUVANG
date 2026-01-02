"use client";

import { useEffect, useState } from "react";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { useGameStore } from "@/store/gameStore";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import { motion, AnimatePresence } from "framer-motion";

export default function StagePage() {
  const state = useGameStore((state) => state.state);
  const [question, setQuestion] = useState<any>(null);
  const [overlay, setOverlay] = useState<"CORRECT" | "WRONG" | "TIMEOUT" | null>(null);

  useHydrateGameState();
  usePusherGameState();

  useEffect(() => {
    if (state?.currentQuestionId) {
      fetch(`/api/questions/${state.currentQuestionId}`)
        .then((res) => res.json())
        .then(setQuestion)
        .catch(console.error);
    }
  }, [state?.currentQuestionId]);

  // Show overlay based on question result (if needed)
  // This would be triggered by game state changes

  if (!state) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white text-4xl"
        style={{
          backgroundImage: "url('/system/bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        Chưa bắt đầu - chờ MC
      </div>
    );
  }

  const isGameActive = state && state.phase !== "IDLE" && state.currentQuestionId;
  const backgroundImage = isGameActive ? "/system/match.jpg" : "/system/bg.png";

  return (
    <div
      className="min-h-screen p-8 relative overflow-hidden"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Timer - Large and prominent */}
      {state.questionTimer && (
        <div className="flex justify-center mb-8">
          <Timer timer={state.questionTimer} size="lg" />
        </div>
      )}

      {/* Question Card - Centered and large */}
      <div className="max-w-5xl mx-auto mb-8">
        {state.currentQuestionId && (
          <QuestionCard
            questionText={question?.text || "Đang tải câu hỏi..."}
            questionNumber={question?.index}
            totalQuestions={12}
            packageNumber={
              state.activePackageId
                ? parseInt(state.activePackageId) || undefined
                : undefined
            }
          />
        )}
      </div>

      {/* Scoreboard - Bottom or side */}
      <div className="max-w-4xl mx-auto">
        <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId?.toString()} />
      </div>

      {/* Overlay for CORRECT/WRONG/TIMEOUT */}
      <AnimatePresence>
        {overlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className={`text-8xl md:text-9xl font-bold ${
                overlay === "CORRECT"
                  ? "text-green-500"
                  : overlay === "WRONG"
                  ? "text-red-500"
                  : "text-yellow-500"
              }`}
              style={{
                textShadow: "0 0 40px currentColor, 0 0 80px currentColor",
              }}
            >
              {overlay === "CORRECT" && "✓ ĐÚNG"}
              {overlay === "WRONG" && "✗ SAI"}
              {overlay === "TIMEOUT" && "⏱ HẾT GIỜ"}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

