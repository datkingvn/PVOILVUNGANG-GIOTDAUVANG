"use client";

import { useEffect, useState } from "react";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { useGameStore } from "@/store/gameStore";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";

export default function GuestPage() {
  const state = useGameStore((state) => state.state);
  const [question, setQuestion] = useState<any>(null);

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

  if (!state) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white"
        style={{
          backgroundImage: "url('/system/bg-link.png')",
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
  const backgroundImage = isGameActive ? "/system/match.jpg" : "/system/bg-link.png";

  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {state.questionTimer && (
        <div className="flex justify-center mb-4">
          <Timer timer={state.questionTimer} size="lg" />
        </div>
      )}

      {state.currentQuestionId && (
        <div className="mb-4">
          <QuestionCard
            questionText={question?.text || "Đang tải câu hỏi..."}
            questionNumber={question?.index}
            totalQuestions={12}
          />
        </div>
      )}

      <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId?.toString()} />
    </div>
  );
}

